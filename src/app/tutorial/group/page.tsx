import { Suspense } from "react";
import { TutorialDetailView } from "@/components/tutorial/TutorialDetailView";

export default function TutorialGroupPage() {
  return (
    <Suspense>
      <TutorialDetailView
        eyebrow="Groups & members"
        title="Groups & members"
        intro="A group is the container for everything — a ski trip, a shared flat, a running tab with your roommates. Here's how to create one, get others in, and manage who's on it."
        steps={[
          {
            title: "Create a group",
            body: "Give the group a name and yours — no email, no password. FairShareTab creates a shareable link on the spot and drops you straight into it.",
            screenshot: {
              src: "/tutorial/create-group.png",
              mobileSrc: "/tutorial/mobile/create-group.png",
              alt: "Create a new group modal with the group name and your name filled in",
            },
          },
          {
            title: "Share the link",
            body: "Anyone with the link can view the group; unless you send the view-only version, they can add and edit bills too. Copy it or send it straight from the share dialog.",
            screenshot: {
              src: "/tutorial/share-dialog.png",
              mobileSrc: "/tutorial/mobile/share-dialog.png",
              alt: "Share dialog showing the group's shareable link with a Copy button",
            },
          },
          {
            title: "See your events",
            body: "Every event you create shows up here, with its own running total and settlement status at a glance.",
            screenshot: {
              src: "/tutorial/events-list.png",
              mobileSrc: "/tutorial/mobile/events-list.png",
              alt: "Events list showing one event card and the group's members",
            },
          },
          {
            title: "Add and manage members",
            body: "Each member has a menu for renaming or deactivating them — deactivated members keep their full bill history, they just stop showing up as an option going forward.",
            screenshot: {
              src: "/tutorial/member-management.png",
              mobileSrc: "/tutorial/mobile/member-management.png",
              alt: "Member chip action menu with View expenses, Rename, and Deactivate options",
            },
          },
        ]}
      />
    </Suspense>
  );
}
