import { Suspense } from "react";
import { TutorialDetailView } from "@/components/tutorial/TutorialDetailView";

export default function TutorialEventPage() {
  return (
    <Suspense>
      <TutorialDetailView
        eyebrow="Inside an event"
        title="Inside an event"
        intro="An event is one trip or occasion — its own currency, its own running total, its own bills. Every active group member joins automatically when you create one."
        steps={[
          {
            title: "Start an event",
            body: "Name it, pick a currency, and optionally set dates. Members aren't chosen here — everyone already in the group is included from the start.",
            screenshot: {
              src: "/tutorial/create-event.png",
              mobileSrc: "/tutorial/mobile/create-event.png",
              alt: "Create a new event modal with the event name filled in",
            },
          },
          {
            title: "The event dashboard",
            body: "Members, total spend, and every bill in one place, with a clear Settled or Unsettled tag on each — plus one-tap access to Add bill and Settle up.",
            screenshot: {
              src: "/tutorial/event-dashboard.png",
              mobileSrc: "/tutorial/mobile/event-dashboard.png",
              alt: "Event dashboard showing members, total spend, and two bills",
            },
          },
          {
            title: "See one person's activity",
            body: "Click a member to see exactly their bills, their share, and what settling would move for them — for this event only, nothing from their other events.",
            screenshot: {
              src: "/tutorial/member-activity.png",
              mobileSrc: "/tutorial/mobile/member-activity.png",
              alt: "One member's activity view for a single event, showing their share and bills",
            },
          },
        ]}
      />
    </Suspense>
  );
}
