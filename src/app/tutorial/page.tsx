import { Suspense } from "react";
import { TutorialView } from "@/components/tutorial/TutorialView";

export default function TutorialPage() {
  return (
    <Suspense>
      <TutorialView />
    </Suspense>
  );
}
