import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { cn } from "@/lib/cn";
import type { ParticipantMember } from "@/lib/bill-participants";

/**
 * Overlapping strip of the members who owe money on a bill. Replaces the old
 * "split N ways" text: shows *who*, not a count (the strip is the count).
 * Amounts live on the bill detail page and are deliberately not shown here.
 *
 * The whole strip is one `role="img"` with an aria-label naming everyone, so
 * a screen reader hears "5 people: Melody, Alice, ..." instead of N separate
 * avatar nodes.
 */
export function BillParticipants({
  participants,
  size = 20,
  className,
}: {
  participants: ParticipantMember[];
  size?: number;
  className?: string;
}) {
  if (participants.length === 0) return null;

  const label = `${participants.length} ${
    participants.length === 1 ? "person" : "people"
  }: ${participants.map((p) => p.name).join(", ")}`;

  return (
    <div className={cn("flex items-center", className)} role="img" aria-label={label}>
      {participants.map((p, i) => (
        <InitialsAvatar
          key={p.id}
          name={p.name}
          color={p.avatarColor}
          size={size}
          className={cn("ring-2 ring-white dark:ring-dark-card", i > 0 && "-ml-0.5")}
        />
      ))}
    </div>
  );
}
