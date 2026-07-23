"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { getDeviceIdentities } from "@/lib/device-identity";
import { GroupSwitcher } from "./GroupSwitcher";

interface GroupHeaderProps {
  groupId: string;
  groupName: string;
}

interface Viewer {
  memberId: string;
  memberName: string;
  memberAvatarColor: string;
}

// Shared nav header for every in-group screen (P3-02 today; P4-01 etc.
// later): logo, group switcher, and the viewer's own avatar. The viewer
// badge is intentionally just an avatar with no text label, so there's no
// bare "you" to render (CLAUDE.md rule 5).
export function GroupHeader({ groupId, groupName }: GroupHeaderProps) {
  const [viewer, setViewer] = useState<Viewer | null>(null);

  useEffect(() => {
    const identity = getDeviceIdentities().find((entry) => entry.groupId === groupId);
    if (identity) {
      setViewer({
        memberId: identity.memberId,
        memberName: identity.memberName,
        memberAvatarColor: identity.memberAvatarColor,
      });
    }
  }, [groupId]);

  return (
    <div className="mb-6 flex items-center justify-between sm:mb-[26px]">
      <Logo size={26} wordmarkClassName="text-base sm:text-[17px]" />
      <GroupSwitcher currentGroupId={groupId} currentGroupName={groupName} />
      {viewer ? (
        <InitialsAvatar
          name={viewer.memberName}
          color={viewer.memberAvatarColor}
          size={36}
          className="hidden sm:flex"
        />
      ) : (
        <div className="hidden sm:block sm:h-9 sm:w-9" />
      )}
    </div>
  );
}
