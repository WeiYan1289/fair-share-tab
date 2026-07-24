"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/cn";
import { getDeviceIdentities, saveDeviceIdentity } from "@/lib/device-identity";

interface JoinMember {
  id: string;
  name: string;
  avatarColor: string;
}

interface JoinScreenProps {
  groupId: string;
  groupName: string;
  members: JoinMember[];
  shareToken: string;
}

// Screen Spec P2-04, route /g/:groupId/join. The "reopening the same link
// skips straight to the group next time" behaviour lives here rather than in
// the token-exchange route, since only this device's local storage (not the
// server session) knows whether it already claimed a member in this group.
export function JoinScreen({ groupId, groupName, members, shareToken }: JoinScreenProps) {
  const [checking, setChecking] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = getDeviceIdentities().find((identity) => identity.groupId === groupId);
    if (existing) {
      window.location.href = `/g/${groupId}/events`;
      return;
    }
    setChecking(false);
  }, [groupId]);

  if (checking) {
    return <div className="min-h-screen bg-cream dark:bg-dark-bg" />;
  }

  const selected = members.find((member) => member.id === selectedId) ?? null;

  async function handleContinue() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/groups/${groupId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: selected.id }),
      });
      if (!res.ok) throw new Error("claim failed");

      saveDeviceIdentity({
        groupId,
        groupName,
        memberId: selected.id,
        memberName: selected.name,
        memberAvatarColor: selected.avatarColor,
        token: shareToken,
        memberCount: members.length,
      });
      window.location.href = `/g/${groupId}/events`;
    } catch {
      setError("Couldn't claim that member — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cream px-6 py-10 dark:bg-dark-bg">
      <ThemeToggle className="absolute top-5 right-5 sm:top-7 sm:right-9" />
      <div className="w-full max-w-[440px] rounded-lg bg-white p-8 text-center shadow-[0_16px_36px_-20px_rgba(19,46,40,0.22)] sm:p-10 dark:bg-dark-card">
        <Logo size={40} wordmark={false} className="mx-auto mb-4 justify-center" />
        <p className="mb-0.5 font-display text-[15px] text-muted italic dark:text-dark-muted">
          You&apos;ve been invited to
        </p>
        <h1 className="num mb-3.5 text-[26px] text-ink dark:text-dark-text">{groupName}</h1>
        <p className="mb-6 text-[13.5px] leading-relaxed text-muted dark:text-dark-muted">
          Pick which one you are, so we can show your personal balance.
        </p>

        <div className="mb-5 flex flex-col gap-2 text-left">
          {members.map((member) => {
            const isSelected = member.id === selectedId;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedId(member.id)}
                className={cn(
                  "flex items-center gap-3 rounded-md border-[1.5px] px-4 py-2.5 text-left transition-colors",
                  isSelected
                    ? "border-forest bg-mint-tint dark:border-mint dark:bg-mint/16"
                    : "border-transparent bg-cream hover:bg-cream-hover dark:bg-dark-bg dark:hover:bg-white/5",
                )}
              >
                <InitialsAvatar name={member.name} color={member.avatarColor} size={38} />
                <span
                  className={cn(
                    "flex-1 text-sm font-bold",
                    isSelected ? "text-forest dark:text-mint" : "text-ink dark:text-dark-text",
                  )}
                >
                  {member.name}
                </span>
                {isSelected && <span className="text-emerald dark:text-mint">✓</span>}
              </button>
            );
          })}

          {/* TODO: opens the add-member flow (P4-04) once that screen is built */}
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-md border border-dashed border-ink/18 bg-app-bg px-4 py-2.5 text-left text-[13px] font-bold text-muted dark:border-white/18 dark:bg-dark-bg dark:text-dark-muted"
          >
            + I&apos;m not listed — add me
          </button>
        </div>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <Button
          variant="primary"
          disabled={!selected || submitting}
          className="w-full !py-4 text-center text-[15px]"
          onClick={handleContinue}
        >
          {selected ? `Continue as ${selected.name}` : "Continue"}
        </Button>
      </div>
    </div>
  );
}
