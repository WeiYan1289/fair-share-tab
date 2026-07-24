"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { shareLinkRoleSchema } from "@/lib/validation/group";

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

// Screen Spec P2-02/P2-03. Editor-only (GET /api/groups/{id}/links rejects
// viewer sessions — system-design.md README "Known gaps" leaves open whether
// viewers should ever reach this dialog, so callers should only render it
// from editor-gated UI). Modal on desktop, bottom sheet on mobile via
// responsive classes on the same markup rather than two components.
export function ShareDialog({ groupId, groupName, onClose }: ShareDialogProps) {
  const [links, setLinks] = useState<Partial<Record<LinkRole, LinkInfo>>>({});
  const [role, setRole] = useState<LinkRole>("editor");
  const [loading, setLoading] = useState(true);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  // Resolved after mount, not during render: `navigator` differs between the
  // server render pass and the client, so checking it synchronously here
  // would cause a hydration mismatch on the "Share via…" button.
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/links`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { links: LinkInfo[] }) => {
        const byRole: Partial<Record<LinkRole, LinkInfo>> = {};
        for (const link of data.links) byRole[link.role] = link;
        setLinks(byRole);
      })
      .finally(() => setLoading(false));
  }, [groupId]);

  const currentLink = links[role];
  const url =
    currentLink && typeof window !== "undefined"
      ? `${window.location.origin}/g/${currentLink.token}`
      : "";

  // The viewer-role link isn't created at group-creation time (only the
  // editor link is — system-design.md §5). Switching to "View only" for the
  // first time lazily creates it via the regenerate endpoint, which
  // no-ops the revoke step when there's nothing to revoke yet.
  async function handleRoleChange(next: LinkRole) {
    setRole(next);
    setCopied(false);
    if (links[next]) return;

    setSwitchingRole(true);
    const res = await fetch(`/api/groups/${groupId}/links/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    if (res.ok) {
      const data: { link: LinkInfo } = await res.json();
      setLinks((prev) => ({ ...prev, [next]: data.link }));
    }
    setSwitchingRole(false);
  }

  function handleCopy() {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShareVia() {
    if (!url || !canShare) return;
    try {
      await navigator.share({ url });
    } catch {
      // user cancelled the native share sheet — nothing to do
    }
  }

  async function handleRegenerateConfirm() {
    setRegenerating(true);
    const res = await fetch(`/api/groups/${groupId}/links/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      const data: { link: LinkInfo } = await res.json();
      setLinks((prev) => ({ ...prev, [role]: data.link }));
      setCopied(false);
    }
    setRegenerating(false);
    setConfirmRegenerate(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[440px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg sm:p-8 dark:bg-dark-card">
        {confirmRegenerate ? (
          <>
            <h2 className="num mb-2.5 text-[21px] text-ink dark:text-dark-text">
              Regenerate this link?
            </h2>
            <p className="mb-6 text-[13.5px] leading-relaxed text-muted dark:text-dark-muted">
              The current link stops working the moment you do this. Anyone still using it will
              land on an expired-link page — you&apos;ll need to share the new one.
            </p>
            <div className="flex gap-2.5">
              <Button
                variant="secondary"
                className="flex-1 text-center"
                onClick={() => setConfirmRegenerate(false)}
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
              Anyone with this link can open the group — no account needed.
            </p>

            <div className="mb-2.5 flex gap-2">
              <div className="flex-1 truncate rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-[13px] text-ink dark:border-white/14 dark:bg-dark-bg dark:text-dark-text">
                {loading || switchingRole ? "Loading…" : (url ?? "—")}
              </div>
              <Button
                variant="primary"
                disabled={!url || loading || switchingRole}
                onClick={handleCopy}
                className="!px-4.5 !py-3 text-[13.5px] whitespace-nowrap"
              >
                Copy link
              </Button>
            </div>

            <p
              className={cn(
                "mb-3 flex items-center gap-1.5 text-xs font-bold text-emerald transition-opacity",
                copied ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              aria-hidden={!copied}
            >
              ✓ Copied to clipboard
            </p>

            {canShare && (
              <button
                type="button"
                onClick={handleShareVia}
                disabled={!url}
                className="mb-4 w-full rounded-md border border-ink/16 bg-white py-3 text-center text-[13.5px] font-bold text-ink hover:bg-cream disabled:opacity-60 sm:hidden dark:border-white/16 dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-bg"
              >
                Share via…
              </button>
            )}

            <p className="mb-2 text-xs font-bold text-muted-2">Link permissions</p>
            <div className="mb-2.5 flex w-fit rounded-md bg-app-bg p-1 dark:bg-dark-bg">
              <button
                type="button"
                onClick={() => handleRoleChange("editor")}
                className={cn(
                  "rounded-[10px] px-4.5 py-2 text-[13px] font-bold",
                  role === "editor"
                    ? "bg-forest text-cream dark:bg-dark-forest"
                    : "text-muted dark:text-dark-muted",
                )}
              >
                Can edit
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("viewer")}
                className={cn(
                  "rounded-[10px] px-4.5 py-2 text-[13px] font-bold",
                  role === "viewer"
                    ? "bg-forest text-cream dark:bg-dark-forest"
                    : "text-muted dark:text-dark-muted",
                )}
              >
                View only
              </button>
            </div>
            <p className="mb-5 text-[12.5px] leading-relaxed text-muted dark:text-dark-muted">
              {role === "editor"
                ? "Can edit — anyone with this link can add, change, and settle bills."
                : "View only — anyone with this link can see bills and balances but can't change anything."}
            </p>

            <div className="mb-6 flex gap-2.5 rounded-md bg-sky-tint px-4 py-3.5 dark:bg-sky/12">
              <span className="text-sm">🔗</span>
              <p className="text-[11.5px] leading-relaxed text-sky-text dark:text-dark-text/80">
                <strong>Heads up</strong> — this link doesn&apos;t need a password. Anyone who has
                it can view this group&apos;s bills, and edit them unless you switch to View only.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setConfirmRegenerate(true)}
                className="text-[13px] font-bold text-gold hover:opacity-80"
              >
                Regenerate link
              </button>
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
