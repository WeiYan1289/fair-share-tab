import { RESET_TOKEN_TTL_MINUTES } from "@/lib/auth/reset-token";
import type { MailMessage } from "./mailer";

type Template = Pick<MailMessage, "subject" | "html" | "text">;

// Brand tokens are duplicated as literals here rather than imported from
// tailwind.config.ts on purpose: email clients strip <style> blocks and
// classes, so every colour has to be an inline literal anyway. Keep these in
// step with the config by hand if the palette changes.
const INK = "#16201B";
const MUTED = "#5B6961";
const FOREST = "#163A2E";
const EMERALD = "#1B9A62";
const CREAM = "#F6F1E7";
const BORDER = "#E4E2DC";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Hidden text that mail clients show as the inbox preview line. Without it
 * they scrape the first visible words, which is usually the wordmark.
 */
function preheader(text: string): string {
  return `<div style="display:none;font-size:0;line-height:0;max-height:0;mso-hide:all;overflow:hidden;opacity:0">${text}</div>`;
}

function wordmark(): string {
  return `<div style="font-size:19px;font-weight:700;letter-spacing:-0.2px;color:${INK}">FairShare<span style="color:${EMERALD}">Tab</span></div>`;
}

/**
 * A table-wrapped anchor rather than a padded <a>: Outlook renders mail
 * through Word, which drops padding on inline elements and would collapse
 * the button into bare underlined text.
 */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
      <tr>
        <td align="center" bgcolor="${FOREST}" style="border-radius:8px">
          <a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${label}</a>
        </td>
      </tr>
    </table>`;
}

function layout(input: { preview: string; heading: string; body: string }): string {
  return `${preheader(input.preview)}
<div style="background-color:${CREAM};padding:28px 16px;font-family:${FONT}">
  <div style="max-width:520px;margin:0 auto">
    <div style="margin-bottom:18px">${wordmark()}</div>
    <div style="background-color:#ffffff;border:1px solid ${BORDER};border-radius:14px;padding:30px 28px">
      <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;font-weight:700;color:${INK}">${input.heading}</h1>
      ${input.body}
    </div>
    <p style="margin:18px 4px 0;font-size:12px;line-height:1.6;color:${MUTED}">
      FairShareTab splits group bills and works out who owes whom.<br />
      This is an automated message about your account — please don't reply to it.
    </p>
  </div>
</div>`;
}

const p = (content: string, size = 15) =>
  `<p style="margin:0 0 14px;font-size:${size}px;line-height:1.65;color:${INK}">${content}</p>`;

const pMuted = (content: string) =>
  `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${MUTED}">${content}</p>`;

export function resetPasswordEmail(input: { resetUrl: string; recipientEmail: string }): Template {
  const { resetUrl, recipientEmail } = input;

  return {
    subject: "Reset your FairShareTab password",
    html: layout({
      preview: `Choose a new password — this link works for ${RESET_TOKEN_TTL_MINUTES} minutes.`,
      heading: "Reset your password",
      body: [
        p(`Someone asked to reset the password for <strong style="color:${INK}">${recipientEmail}</strong>. If that was you, choose a new one here:`),
        button(resetUrl, "Choose a new password"),
        // The visible URL is the anti-phishing measure: a recipient can read
        // where the button actually goes instead of trusting link text, and
        // it gives a working fallback when the button doesn't render.
        pMuted(
          `Or paste this address into your browser:<br /><span style="color:${MUTED};word-break:break-all">${resetUrl}</span>`,
        ),
        `<hr style="border:none;border-top:1px solid ${BORDER};margin:20px 0" />`,
        pMuted(
          `This link expires in <strong>${RESET_TOKEN_TTL_MINUTES} minutes</strong> and can only be used once.`,
        ),
        pMuted(
          "If you didn't ask for this, you can safely ignore this email. Your password stays as it is, and nobody can change it without the link above.",
        ),
      ].join("\n      "),
    }),
    text: [
      "Reset your FairShareTab password",
      "",
      `Someone asked to reset the password for ${recipientEmail}.`,
      "If that was you, open the link below to choose a new one:",
      "",
      resetUrl,
      "",
      `This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes and can only be used once.`,
      "",
      "If you didn't ask for this, you can safely ignore this email. Your",
      "password stays as it is, and nobody can change it without the link above.",
      "",
      "--",
      "FairShareTab splits group bills and works out who owes whom.",
      "This is an automated message about your account - please don't reply to it.",
    ].join("\n"),
  };
}

/**
 * Sent after a completed reset. A security control, not a courtesy: it is
 * how someone finds out that another person reset their password. It only
 * fires on a successful reset, which requires a valid token, so it carries
 * no abuse volume of its own.
 */
export function passwordChangedEmail(input: { recipientEmail: string }): Template {
  const { recipientEmail } = input;

  return {
    subject: "Your FairShareTab password was changed",
    html: layout({
      preview: "If this wasn't you, reset your password straight away.",
      heading: "Your password was changed",
      body: [
        p(`The password for <strong style="color:${INK}">${recipientEmail}</strong> was just changed, and you've been signed out on every device.`),
        pMuted("You'll need to log in again with the new password."),
        `<hr style="border:none;border-top:1px solid ${BORDER};margin:20px 0" />`,
        pMuted(
          "<strong>If this wasn't you</strong>, someone else may have access to your account. Reset your password immediately to take it back.",
        ),
      ].join("\n      "),
    }),
    text: [
      "Your FairShareTab password was changed",
      "",
      `The password for ${recipientEmail} was just changed, and you've been`,
      "signed out on every device. You'll need to log in again with the new",
      "password.",
      "",
      "If this wasn't you, someone else may have access to your account.",
      "Reset your password immediately to take it back.",
      "",
      "--",
      "FairShareTab splits group bills and works out who owes whom.",
      "This is an automated message about your account - please don't reply to it.",
    ].join("\n"),
  };
}
