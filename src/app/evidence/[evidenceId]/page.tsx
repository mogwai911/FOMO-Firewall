import { redirect } from "next/navigation";

interface LegacyEvidencePageProps {
  params: Promise<{ evidenceId: string }>;
}

export default async function LegacyEvidencePage({ params }: LegacyEvidencePageProps) {
  const { evidenceId } = await params;
  redirect(`/app/evidence/${evidenceId}`);
}
