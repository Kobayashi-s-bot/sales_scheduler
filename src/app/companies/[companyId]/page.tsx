import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CompanyForm, ContactForm, EventForm, SalesHistoryForm } from "@/components/data-forms";
import { RecommendationCard, type RecommendationView } from "@/components/recommendation-card";
import { requireOrganizationContext } from "@/lib/auth/server";
export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({ params, searchParams }: { params: Promise<{ companyId: string }>; searchParams: Promise<{ organizationId?: string }> }) {
  const [{ companyId }, query] = await Promise.all([params, searchParams]);
  const organizationId = query.organizationId; if (!organizationId) notFound();
  const { supabase, organization } = await requireOrganizationContext(organizationId);
  const [companyResult, recommendationsResult, historyResult, eventsResult, contactsResult] = await Promise.all([
    supabase.from("companies").select("id,name,industry,website_url,description").eq("organization_id", organizationId).eq("id", companyId).maybeSingle(),
    supabase.from("sales_recommendations").select("recommended_on,reason,status,evidence").eq("organization_id", organizationId).eq("company_id", companyId).eq("status", "pending").order("recommended_on"),
    supabase.from("sales_history").select("id,occurred_on,activity_type,outcome,notes").eq("organization_id", organizationId).eq("company_id", companyId).order("occurred_on", { ascending: false }),
    supabase.from("events").select("id,occurred_on,event_type,title,source_url").eq("organization_id", organizationId).eq("company_id", companyId).order("occurred_on", { ascending: false, nullsFirst: false }),
    supabase.from("contacts").select("id,full_name,department,email,phone").eq("organization_id", organizationId).eq("company_id", companyId).order("created_at"),
  ]);
  if (companyResult.error || !companyResult.data) notFound(); const company = companyResult.data;
  return <AppShell organizationId={organizationId} organizationName={organization.name}><main className="page-container">
    <header><p className="eyebrow">企業詳細</p><h1 className="mt-2 text-3xl font-bold">{company.name}</h1><p className="mt-1 text-stone-600">{company.industry ?? "業種未設定"}</p></header>
    <section className="mt-7"><h2 className="section-title">次回営業推奨</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{recommendationsResult.data?.length ? recommendationsResult.data.map((item, index) => <RecommendationCard key={`${item.recommended_on}-${index}`} recommendation={item as RecommendationView} />) : <div className="empty-state">推奨はまだありません。イベントと営業タイミングルールを登録してください。</div>}</div></section>
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-2"><details className="card p-5"><summary className="cursor-pointer font-semibold">企業情報を編集</summary><div className="mt-5"><CompanyForm organizationId={organizationId} company={company} /></div></details><section className="card p-5"><h2 className="section-title">営業結果を入力</h2><p className="mb-4 text-sm text-stone-600">外出先でも、この画面からすぐ記録できます。</p><SalesHistoryForm organizationId={organizationId} companyId={companyId} /></section></div>
    <section className="mt-7"><div className="mb-3 flex items-center justify-between"><h2 className="section-title">担当者</h2><span className="text-sm text-stone-500">{contactsResult.data?.length ?? 0}名</span></div><div className="grid gap-4 lg:grid-cols-2">{(contactsResult.data ?? []).map((contact) => <details className="card p-5" key={contact.id}><summary className="cursor-pointer"><strong>{contact.full_name || "氏名未設定"}</strong><span className="ml-2 text-sm text-stone-500">{contact.department}</span><p className="mt-1 text-sm text-stone-600">{contact.email || contact.phone || "連絡先未設定"}</p></summary><div className="mt-5"><ContactForm organizationId={organizationId} companyId={companyId} contact={contact} /></div></details>)}<details className="card border-dashed p-5" open={!contactsResult.data?.length}><summary className="cursor-pointer font-semibold">担当者を追加</summary><div className="mt-5"><ContactForm organizationId={organizationId} companyId={companyId} /></div></details></div></section>
    <section className="mt-7"><h2 className="section-title">営業履歴</h2>{historyResult.data?.length ? <ol className="mt-3 space-y-3">{historyResult.data.map((history) => <li className="card p-4" key={history.id}><div className="flex flex-wrap justify-between gap-2"><strong>{history.activity_type}</strong><time className="text-sm text-stone-500">{history.occurred_on}</time></div>{history.outcome ? <p className="mt-1 text-sm">結果：{history.outcome}</p> : null}{history.notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{history.notes}</p> : null}</li>)}</ol> : <div className="empty-state mt-3">履歴はまだありません。上のフォームから最初の結果を記録してください。</div>}</section>
    <section className="mt-7"><h2 className="section-title">イベント</h2><ul className="mt-3 space-y-2">{(eventsResult.data ?? []).map((event) => <li key={event.id} className="card p-4">{event.occurred_on ?? "日付不明"} — {event.title}（{event.event_type}）</li>)}</ul><details className="card mt-3 p-5"><summary className="cursor-pointer font-semibold">イベントを登録</summary><div className="mt-5"><EventForm organizationId={organizationId} companyId={companyId} /></div></details></section>
  </main></AppShell>;
}
