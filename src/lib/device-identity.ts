const STORAGE_KEY = "fst-device-identities";

/**
 * A group this device has claimed an identity in. data-model.md §4 only
 * documents storing `group_id -> member_id` client-side (personalisation,
 * never authorisation), but our session cookie only ever holds one active
 * {groupId, role, shareLinkId} at a time (system-design.md §3.2) -- so
 * "switching" to another stored group (Screen Spec P1-02, P3-01) has to
 * re-exchange that group's token to get a fresh session. That requires
 * caching the token here too, alongside the display fields the landing
 * screen needs so it doesn't have to fetch anything before first paint.
 */
export interface DeviceGroupIdentity {
  groupId: string;
  groupName: string;
  memberId: string;
  memberName: string;
  token: string;
  memberCount: number;
}

function readAll(): DeviceGroupIdentity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(identities: DeviceGroupIdentity[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identities));
}

/** Most-recently-used first. */
export function getDeviceIdentities(): DeviceGroupIdentity[] {
  return readAll();
}

export function saveDeviceIdentity(identity: DeviceGroupIdentity) {
  const rest = readAll().filter((g) => g.groupId !== identity.groupId);
  writeAll([identity, ...rest]);
}

export function removeDeviceIdentity(groupId: string) {
  writeAll(readAll().filter((g) => g.groupId !== groupId));
}

export function clearDeviceIdentities() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
