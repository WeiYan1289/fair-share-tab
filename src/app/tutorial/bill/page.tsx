import { TutorialDetailView } from "@/components/tutorial/TutorialDetailView";

export default function TutorialBillPage() {
  return (
    <TutorialDetailView
      eyebrow="Logging bills"
      title="Logging bills"
      intro="A bill is what it's for, the total, who paid, and who it's split between — payer and participants are independent, so someone can pay for a bill they aren't even part of."
      steps={[
        {
          title: "Split a bill evenly",
          body: "Enter what it's for, the total, who paid, and who it's split between — FairShareTab handles the rounding for you, down to the cent.",
          screenshot: {
            src: "/tutorial/add-bill-equal.png",
            mobileSrc: "/tutorial/mobile/add-bill-equal.png",
            alt: "Add a bill form with an equal split among three members",
          },
        },
        {
          title: "Or type exact amounts",
          body: "Switch to custom amounts when a bill isn't even — a running total keeps you honest until it matches the bill exactly.",
          screenshot: {
            src: "/tutorial/add-bill-custom.png",
            mobileSrc: "/tutorial/mobile/add-bill-custom.png",
            alt: "Add a bill form with custom per-member amounts and a running total",
          },
        },
        {
          title: "Settled bills lock",
          body: "Double-check a bill before you settle it — once it's part of a settle-up, it's locked read-only for good.",
          screenshot: {
            src: "/tutorial/bill-locked.png",
            mobileSrc: "/tutorial/mobile/bill-locked.png",
            alt: "A settled bill shown in its locked, read-only state",
          },
        },
      ]}
    />
  );
}
