"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// On the workspace route, sends small screens back to the classic events list
// (the one-page layout is desktop-only). Client-side only, so a bookmarked
// workspace URL opened on a phone falls back cleanly. The reverse direction
// (desktop default -> workspace) is handled by a pre-paint script on the events
// page, which avoids the classic-then-redirect flash.
export function DesktopWorkspaceRedirect({ to }: { to: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) router.replace(to);
  }, [to, router]);

  return null;
}
