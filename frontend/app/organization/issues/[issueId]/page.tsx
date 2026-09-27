import { redirect } from 'next/navigation';

export default async function OrganizationIssueDetailsRedirect({
  params,
}: {
  params: Promise<{ issueId: string }>;
}) {
  const { issueId } = await params;
  redirect(`/org/issues/${issueId}`);
}
