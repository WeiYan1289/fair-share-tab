export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * Logs the message instead of sending it. Lets the whole reset flow be
 * built and exercised locally with no API key, no domain, and no quota --
 * the reset link is printed to the dev server's terminal, ready to paste
 * into a browser.
 *
 * Selected by MAILER=console. Never selected in production: getMailer
 * throws instead of silently swallowing mail there.
 */
export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.log(
      ["", "--- ConsoleMailer ---", `to:      ${message.to}`, `subject: ${message.subject}`, "", message.text, "---------------------", ""].join(
        "\n",
      ),
    );
  }
}

/**
 * Sends through Resend's HTTP API.
 *
 * Deliberately a plain fetch rather than the `resend` SDK: this is one POST
 * to one endpoint, so the dependency would buy a thin wrapper and a version
 * to keep current. Injecting fetchImpl also keeps the transport testable
 * without a network or an API key.
 */
export class ResendMailer implements Mailer {
  private readonly apiKey: string;
  private readonly from: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: { apiKey: string; from: string; fetchImpl?: typeof fetch }) {
    this.apiKey = config.apiKey;
    this.from = config.from;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async send(message: MailMessage): Promise<void> {
    const response = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      // This runs inside after(), past the response, where a hung request
      // would hold the serverless invocation open for nothing.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      // Thrown, not swallowed: the caller logs it. An unverified domain or a
      // revoked key must not look like a successful send, because the user
      // has already been shown "check your email".
      throw new Error(`Resend rejected the send (${response.status}): ${detail}`);
    }
  }
}

let cached: Mailer | null = null;

/**
 * Resolves the transport from MAILER. Deliberately fails loudly on a
 * misconfiguration rather than falling back to ConsoleMailer: a production
 * deploy that silently logged reset emails instead of sending them would
 * look healthy while locking every user out of recovery.
 */
export function getMailer(): Mailer {
  if (cached) return cached;

  const transport = process.env.MAILER;

  if (transport === "console") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MAILER=console is not allowed in production — no mail would be delivered");
    }
    cached = new ConsoleMailer();
    return cached;
  }

  if (transport === "resend") {
    // Checked here rather than at first send: a missing key should fail on
    // the first request, not silently inside the after() block where the
    // user has already been told to check their email.
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set but MAILER=resend");
    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error("EMAIL_FROM is not set but MAILER=resend");

    cached = new ResendMailer({ apiKey, from });
    return cached;
  }

  throw new Error(`MAILER must be "console" or "resend" (got ${transport ?? "unset"})`);
}

/** Test seam — lets a caller substitute a recording mailer. */
export function setMailerForTesting(mailer: Mailer | null): void {
  cached = mailer;
}
