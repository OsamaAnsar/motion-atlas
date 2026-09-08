import { GenerationDetail } from "@/components/generation-detail";

export default async function GenerationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GenerationDetail id={id} />;
}
