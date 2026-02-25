import { redirect } from "next/navigation";

export default function AppSourcesPage() {
  redirect("/app/settings?section=rss");
}
