import { Suspense } from "react";
import { TutorialDetailView } from "@/components/tutorial/TutorialDetailView";

export default function TutorialSettleUpPage() {
  return (
    <Suspense>
      <TutorialDetailView
        eyebrow="Settling up"
        title="Settling up"
        intro="Settling up is strictly one event at a time, so there's never a currency to reconcile — pick the bills, see the transfers, confirm."
        steps={[
          {
            title: "Pick which bills to settle",
            body: "Select any unsettled bills from the event — every bill is selected by default — then calculate.",
            screenshot: {
              src: "/tutorial/settle-select.png",
              mobileSrc: "/tutorial/mobile/settle-select.png",
              alt: "Settle up screen with a list of unsettled bills, all selected",
            },
          },
          {
            title: "See the fewest transfers",
            body: "FairShareTab nets everything down to the smallest possible set of person-to-person payments — nobody sends more than they have to.",
            screenshot: {
              src: "/tutorial/settle-transfers.png",
              mobileSrc: "/tutorial/mobile/settle-transfers.png",
              alt: "Transfer graph showing the minimal set of payments to settle everyone",
            },
          },
          {
            title: "Confirm and lock it in",
            body: "Confirming marks every selected bill settled and resets balances to zero for them — this can't be undone.",
            screenshot: {
              src: "/tutorial/settle-confirm.png",
              mobileSrc: "/tutorial/mobile/settle-confirm.png",
              alt: "Confirmation modal listing the transfers about to be marked as settled",
            },
          },
        ]}
      />
    </Suspense>
  );
}
