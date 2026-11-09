import { redirect } from "next/navigation";

export default async function LegacyPublicCallPage({ params }) {
  const { slug } = await params;
  redirect(`/agent/${slug}/call`);
}
