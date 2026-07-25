"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { shareLinkRoleSchema } from "@/lib/validation/group";
import { Check, Link } from "lucide-react";

type LinkRole = z.infer<typeof shareLinkRoleSchema>;

interface LinkInfo {
  id: string;
  role: LinkRole;
  token: string;
}

interface ShareDialogProps {
  groupId: string;
  groupName: string;
  onClose: () => void;
}

const ROLE_COPY: Record<LinkRole, { label: string; description: string }> = {
  editor: {
    label: "Can edit",
    description: "Adds, changes, and settles bills.",
  },
  viewer: {
    label: "View only",
    description: "Sees bills and balances, can't change anything.",
  },
};

// Screen Spec P2-02/P2-03. Editor-only (GET /api/groups/{id}/links rejects
// viewer sessions). Both links are shown side by side rather than behind a
// role toggle over a single URL field -- the toggle made it easy to copy
// the wrong link without noticing it had switched underneath you, and made
// "Regenerate link" ambiguous about which link it touched. Modal on
// desktop, bottom sheet on mobile via responsive classes on one markup.
export function ShareDialog({ groupId, groupName, onClose }: ShareDialogProps) {
  const [links, setLinks] = useState<Partial<Record<LinkRole, LinkInfo>>>({});
  const [loading, setLoading] = useState(true);
  const [copiedRole, setCopiedRole] = useState<LinkRole | null>(null);
  const [confirmRole, setConfirmRole] = useState<LinkRole | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  // Resolved after mount, not during render: `navigator` differs between the
  // server render pass and the client, so checking it synchronously here
  // would cause a hydration mismatch on the "Share via…" button.
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLinks() {
      const res = await fetch(`/api/groups/${groupId}/links`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data: { links: LinkInfo[] } = await res.json();
      const byRole: Partial<Record<LinkRole, LinkInfo>> = {};
      for (const link of data.links) byRole[link.role] = link;

      // The viewer-role link isn't created at group-creation time (only the
      // editor link is — system-design.md §5). Create it up front here so
      // both links are ready to show side by side, instead of lazily
      // creating it the first time someone toggled to "View only".
      if (!byRole.viewer) {
        const createRes = await fetch(`/api/groups/${groupId}/links/regenerate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "viewer" }),
        });
        if (createRes.ok) {
          const created: { link: LinkInfo } = await createRes.json();
          byRole.viewer = created.link;
        }
      }

      if (!cancelled) {
        setLinks(byRole);
        setLoading(false);
      }
    }

    loadLinks();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  function urlFor(link: LinkInfo | undefined): string {
    if (!link || typeof window === "undefined") return "";
    return `${window.location.origin}/g/${link.token}`;
  }

  function handleCopy(role: LinkRole) {
    const url = urlFor(links[role]);
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedRole(role);
    setTimeout(() => setCopiedRole((current) => (current === role ? null : current)), 2000);
  }

  async function handleShareVia(role: LinkRole) {
    const url = urlFor(links[role]);
    if (!url || !canShare) return;
    try {
      await navigator.share({ url });
    } catch {
      // user cancelled the native share sheet — nothing to do
    }
  }

  async function handleRegenerateConfirm() {
    if (!confirmRole) return;
    setRegenerating(true);
    const res = await fetch(`/api/groups/${groupId}/links/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: confirmRole }),
    });
    if (res.ok) {
      const data: { link: LinkInfo } = await res.json();
      setLinks((prev) => ({ ...prev, [confirmRole]: data.link }));
      setCopiedRole((current) => (current === confirmRole ? null : current));
    }
    setRegenerating(false);
    setConfirmRole(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[460px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg sm:p-8 dark:bg-dark-card">
        {confirmRole ? (
          <>
            <h2 className="num mb-2.5 text-[21px] text-ink dark:text-dark-text">
              Regenerate the {ROLE_COPY[confirmRole].label.toLowerCase()} link?
            </h2>
            <p className="mb-6 text-[13.5px] leading-relaxed text-muted dark:text-dark-muted">
              The current {ROLE_COPY[confirmRole].label.toLowerCase()} link stops working the
              moment you do this. Anyone still using it will land on an expired-link page —
              you&apos;ll need to share the new one. The other link is not affected.
            </p>
            <div className="flex gap-2.5">
              <Button
                variant="secondary"
                className="flex-1 text-center"
                onClick={() => setConfirmRole(null)}
              >
                Cancel
              </Button>
              <button
                type="button"
                disabled={regenerating}
                onClick={handleRegenerateConfirm}
                className="flex-1 rounded-md bg-gold py-3.5 text-center text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                Regenerate link
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="num mb-1 text-[22px] text-ink dark:text-dark-text">
              Share {groupName}
            </h2>
            <p className="mb-5 text-[13px] leading-relaxed text-muted dark:text-dark-muted">
              Two separate links, no account needed for either — pick the one that fits who
              you&apos;re sending it to.
            </p>

            <div className="mb-5 flex flex-col gap-3">
              {(["editor", "viewer"] as const).map((role) => {
                const link = links[role];
                const url = urlFor(link);
                const copied = copiedRole === role;
                return (
                  <div
                    key={role}
                    className="rounded-md border border-ink/10 p-3.5 dark:border-white/10"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-bold",
                          role === "editor"
                            ? "bg-mint-tint text-emerald dark:bg-mint/16 dark:text-mint"
                            : "bg-sky-tint text-sky dark:bg-sky/16",
                        )}
                      >
                        {ROLE_COPY[role].label}
                      </span>
                      <button
                        type="button"
                        disabled={loading || !link}
                        onClick={() => setConfirmRole(role)}
                        className="text-[12px] font-bold text-gold hover:opacity-80 disabled:opacity-50"
                      >
                        Regenerate
                      </button>
                    </div>

                    <div className="mb-2 flex gap-2">
                      <div className="flex-1 truncate rounded-md border border-ink/14 bg-cream px-3 py-2.5 text-[12.5px] text-ink dark:border-white/14 dark:bg-dark-bg dark:text-dark-text">
                        {loading ? "Loading…" : url || "—"}
                      </div>
                      <Button
                        variant="primary"
                        disabled={!url}
                        onClick={() => handleCopy(role)}
                        className="!px-4 !py-2.5 text-[13px] whitespace-nowrap"
                      >
                        Copy
                      </Button>
                      {canShare && (
                        <button
                          type="button"
                          disabled={!url}
                          onClick={() => handleShareVia(role)}
                          aria-label={`Share ${ROLE_COPY[role].label.toLowerCase()} link via…`}
                          className="rounded-md border border-ink/16 bg-white px-3 text-ink disabled:opacity-50 sm:hidden dark:border-white/16 dark:bg-dark-card dark:text-dark-text"
                        >
                          ↗
                        </button>
                      )}
                    </div>

                    <p
                      className={cn(
                        "mb-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald transition-opacity dark:text-mint",
                        copied ? "opacity-100" : "pointer-events-none h-0 opacity-0",
                      )}
                      aria-hidden={!copied}
                    >
                      <Check className="h-3 w-3" aria-hidden="true" /> Copied to clipboard
                    </p>

                    <p className="text-[12px] leading-relaxed text-muted dark:text-dark-muted">
                      {ROLE_COPY[role].description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mb-6 flex gap-2.5 rounded-md bg-sky-tint px-4 py-3.5 dark:bg-sky/12">
              <Link className="h-4 w-4 shrink-0 text-sky-text dark:text-dark-text/80" aria-hidden="true" />
              <p className="text-[11.5px] leading-relaxed text-sky-text dark:text-dark-text/80">
                <strong>Heads up</strong> — neither link needs a password. Send the edit link only
                to people you trust with changes; use the view-only link for anyone who should
                just be able to check balances.
              </p>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={onClose} className="!px-6 !py-3">
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
