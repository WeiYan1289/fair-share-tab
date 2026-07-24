"use client";

import { Logo } from "@/components/ui/Logo";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { DeviceGroupIdentity } from "@/lib/device-identity";

interface ReturningDeviceLandingProps {
  identities: DeviceGroupIdentity[];
  onUseDifferentLink: () => void;
}

// Screen Spec P1-02. "Continue" and each stored-group row both re-exchange
// that group's cached token (GET /g/{token}) to establish a fresh session
// cookie for it -- see the note on DeviceGroupIdentity for why the token has
// to be cached alongside the memberId.
export function ReturningDeviceLanding({
  identities,
  onUseDifferentLink,
}: ReturningDeviceLandingProps) {
  const [primary, ...rest] = identities;

  function continueTo(identity: DeviceGroupIdentity) {
    window.location.href = `/g/${identity.token}`;
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-dark-bg">
      <div className="mx-auto max-w-[1160px] px-6 py-10 sm:px-10 sm:py-14">
        <div className="mb-11 flex items-center justify-between sm:mb-13">
          <Logo size={26} wordmarkClassName="text-lg" />
          <ThemeToggle />
        </div>

        <div className="mx-auto max-w-[440px]">
          <h1 className="num mb-1.5 text-2xl text-ink sm:text-[25px] dark:text-dark-text">
            Welcome back, {primary.memberName}.
          </h1>
          <p className="mb-6 text-[13px] text-muted sm:text-[13.5px] dark:text-dark-muted">
            Pick up where you left off.
          </p>

          <button
            type="button"
            onClick={() => continueTo(primary)}
            className="mb-5 flex w-full items-center justify-between rounded-lg bg-forest px-5 py-5 text-left shadow-[0_16px_32px_-18px_rgba(19,46,40,0.35)] transition-opacity hover:opacity-95"
          >
            <div className="flex items-center gap-3.5">
              <InitialsAvatar
                name={primary.groupName}
                colorSeed={primary.groupId}
                shape="square"
                size={44}
                className="!bg-mint !text-[#12251C]"
              />
              <div>
                <p className="mb-0.5 text-[11px] tracking-wide text-dark-muted uppercase">
                  Continue to
                </p>
                <p className="text-[17px] font-bold text-cream">{primary.groupName}</p>
              </div>
            </div>
            <span className="text-lg text-mint">→</span>
          </button>

          {rest.length > 0 && (
            <>
              <p className="mb-2.5 text-[11.5px] font-bold tracking-wide text-muted-2 uppercase">
                Other groups on this device
              </p>
              <div className="mb-6 flex flex-col gap-2.5">
                {rest.map((identity) => (
                  <button
                    key={identity.groupId}
                    type="button"
                    onClick={() => continueTo(identity)}
                    className="flex items-center gap-3 rounded-lg border border-ink/8 px-3 py-2.5 text-left hover:bg-white dark:border-white/8 dark:hover:bg-dark-card"
                  >
                    <InitialsAvatar
                      name={identity.groupName}
                      colorSeed={identity.groupId}
                      shape="square"
                      size={32}
                    />
                    <div className="flex-1">
                      <p className="text-[13.5px] font-bold text-ink dark:text-dark-text">
                        {identity.groupName}
                      </p>
                      <p className="text-[11px] text-muted-2">
                        {identity.memberCount} member{identity.memberCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="text-center text-[12.5px] text-muted-2">
            Not you?{" "}
            <button
              type="button"
              onClick={onUseDifferentLink}
              className="font-bold text-link hover:text-forest dark:text-mint dark:hover:opacity-80"
            >
              Use a different link
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
