import { notFound } from "next/navigation";
import { requireOrganizationMembership } from "@/lib/auth/server";
import { RecommendationCard, type RecommendationView } from "@/components/recommendation-card";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({ params, searchParams }: { params: Promise<{ companyId: string }>; searchParams: Promise<{ organizationId?: string }> }) {
  const [{ companyId }, query] = await Promise.all([params, searchParams]);
  if (!query.organizationId) notFound();
  const { supabase } = await requireOrganizationMembership(query.organizationId);
  const [companyResult, recommendationsResult, historyResult, eventsResult] = await Promise.all([
    supabase.from("companies").select("id,name,industry,website_url,description").eq("organization_id", query.organizationId).eq("id", companyId).maybeSingle(),
    supabase.from("sales_recommendations").select("recommended_on,reason,status,evidence").eq("organization_id", query.organizationId).eq("company_id", companyId).eq("status", "pending").order("recommended_on"),
    supabase.from("sales_history").select("id,occurred_on,activity_type,outcome").eq("organization_id", query.organizationId).eq("company_id", companyId).order("occurred_on", { ascending: false }),
    supabase.from("events").select("id,occurred_on,event_type,title,source_url").eq("organization_id", query.organizationId).eq("company_id", companyId).order("occurred_on", { ascending: false, nullsFirst: false }),
  ]);
  if (companyResult.error || !companyResult.data) notFound();
  const company = companyResult.data;
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header><p className="text-sm text-teal-700">企業詳細</p><h1 className="text-3xl font-bold">{company.name}</h1><p className="text-neutral-600">{company.industry ?? "業種未設定"}</p></header>
      <section><h2 className="mb-3 text-xl font-semibold">次回推奨</h2><div className="grid gap-3 md:grid-cols-2">{(recommendationsResult.data ?? []).length ? (recommendationsResult.data ?? []).map((item, index) => <RecommendationCard key={`${item.recommended_on}-${index}`} recommendation={item as RecommendationView} />) : <p>推奨はまだありません。</p>}</div></section>
      <section><h2 className="mb-3 text-xl font-semibold">イベント</h2><ul className="space-y-2">{(eventsResult.data ?? []).map((event) => <li key={event.id} className="rounded border bg-white p-3">{event.occurred_on ?? "日付不明"} — {event.title}（{event.event_type}）</li>)}</ul></section>
      <section><h2 className="mb-3 text-xl font-semibold">過去案件・アプローチ履歴</h2><ul className="space-y-2">{(historyResult.data ?? []).map((history) => <li key={history.id} className="rounded border bg-white p-3">{history.occurred_on} — {history.activity_type}{history.outcome ? ` / ${history.outcome}` : ""}</li>)}</ul></section>
    </main>
  );
}
