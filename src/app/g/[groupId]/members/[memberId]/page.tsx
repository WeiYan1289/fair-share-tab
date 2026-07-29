import { redirect } from "next/navigation";

// /members/{id} has no content of its own -- expenses is the default tab
// (Screen Spec P4-06/P4-07).
export default async function MemberPage({
  params,
}: {
  params: Promise<{ groupId: string; memberId: string }>;
}) {
  const { groupId, memberId } = await params;
  redirect(`/g/${groupId}/members/${memberId}/expenses`);
}
