"use client";

import { useEffect, useState } from "react";
import { getDeviceIdentities, clearDeviceIdentities } from "@/lib/device-identity";
import type { DeviceGroupIdentity } from "@/lib/device-identity";
import { ColdVisitorLanding } from "./ColdVisitorLanding";
import { ReturningDeviceLanding } from "./ReturningDeviceLanding";

// Whether this device has a stored identity only exists client-side
// (localStorage), so this reads it after mount and picks P1-01 vs P1-02
// accordingly. There's no dedicated loading mockup for this specific check
// (P7-02 covers events list / dashboard / settle-up, not landing), so the
// gap between server render and this decision is left blank rather than
// invented.
export function LandingGate() {
  const [identities, setIdentities] = useState<DeviceGroupIdentity[] | null>(null);
  const [forceCold, setForceCold] = useState(false);

  useEffect(() => {
    setIdentities(getDeviceIdentities());
  }, []);

  if (identities === null) {
    return <div className="min-h-screen bg-cream" />;
  }

  if (identities.length > 0 && !forceCold) {
    return (
      <ReturningDeviceLanding
        identities={identities}
        onUseDifferentLink={() => {
          clearDeviceIdentities();
          setIdentities([]);
          setForceCold(true);
        }}
      />
    );
  }

  return <ColdVisitorLanding />;
}
