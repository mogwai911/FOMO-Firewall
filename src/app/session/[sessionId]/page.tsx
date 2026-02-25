import { redirect } from "next/navigation";

interface LegacySessionPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function LegacySessionPage({ params }: LegacySessionPageProps) {
  const { sessionId } = await params;
  redirect(`/app/session/${sessionId}`);
}
