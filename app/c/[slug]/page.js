import { redirect } from "next/navigation";

export default async function LegacyPublicCsrPage({ params }) {
  const { slug } = await params;
  redirect(`/agent/${slug}`);
}
