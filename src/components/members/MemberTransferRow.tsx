import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

interface MemberTransferRowProps {
  memberName: string;
  otherName: string;
  direction: "pays" | "receives";
  amount: number;
  currency: string;
}

// One settlement transfer touching a single member, phrased "{payer} pays
// {payee}" so it reads the same whichever end you're looking from -- no
// "you" (CLAUDE.md rule 5). Shared by the cross-event Balance tab and the
// single-event activity screen so a transfer row never looks different
// depending on which screen it's rendered from.
export function MemberTransferRow({ memberName, otherName, direction, amount, currency }: MemberTransferRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <p className="text-[13.5px] text-ink dark:text-dark-text">
        {direction === "pays" ? (
          <>
            <span className="font-bold">{memberName}</span> pays {otherName}
          </>
        ) : (
          <>
            <span className="font-bold">{otherName}</span> pays {memberName}
          </>
        )}
      </p>
      <p
        className={cn(
          "num text-[14.5px]",
          direction === "pays" ? "text-coral" : "text-emerald dark:text-mint",
        )}
      >
        {formatMoney(amount, currency)}
      </p>
    </div>
  );
}
