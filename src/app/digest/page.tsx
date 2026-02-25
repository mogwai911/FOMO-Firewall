import { redirect } from "next/navigation";

export default function LegacyDigestPage() {
  redirect("/app/digest");
}
