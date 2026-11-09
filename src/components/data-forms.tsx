"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

function useSubmit(onSuccess?: (data: unknown) => void) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  async function submit(url: string, method: string, body: object) { setPending(true); setMessage(""); try { const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) { setMessage("保存できませんでした。入力内容を確認してください。"); return false; } setMessage("保存しました"); onSuccess?.(result.data); router.refresh(); return true; } catch { setMessage("通信に失敗しました。時間をおいて再試行してください。"); return false; } finally { setPending(false); } }
  return { submit, pending, message };
}
function FormStatus({ pending, message }: { pending: boolean; message: string }) { return <div className="flex items-center gap-3"><button className="primary-button" disabled={pending}>{pending ? "保存中…" : "保存"}</button>{message ? <span className={message === "保存しました" ? "text-sm text-teal-700" : "form-error"} role="status">{message}</span> : null}</div>; }

export type CompanyFormValue = { id?: string; name?: string; industry?: string | null; website_url?: string | null; description?: string | null };
export function CompanyForm({ organizationId, company }: { organizationId: string; company?: CompanyFormValue }) {
  const router = useRouter(); const state = useSubmit((data) => { if (!company?.id && data && typeof data === "object" && "id" in data) router.push(`/companies/${String(data.id)}?organizationId=${organizationId}`); });
  async function action(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await state.submit(company?.id ? `/api/companies/${company.id}` : "/api/companies", company?.id ? "PATCH" : "POST", { organizationId, name: form.get("name"), industry: form.get("industry"), websiteUrl: form.get("websiteUrl"), description: form.get("description") }); }
  return <form className="form-grid" onSubmit={action}><label className="field-label sm:col-span-2">会社名<input className="field" name="name" defaultValue={company?.name ?? ""} required maxLength={200} /></label><label className="field-label">業種・業界<input className="field" name="industry" defaultValue={company?.industry ?? ""} maxLength={100} /></label><label className="field-label">Webサイト<input className="field" name="websiteUrl" type="url" defaultValue={company?.website_url ?? ""} maxLength={2048} /></label><label className="field-label sm:col-span-2">備考<textarea className="field min-h-28" name="description" defaultValue={company?.description ?? ""} maxLength={5000} /></label><div className="sm:col-span-2"><FormStatus {...state} /></div></form>;
}

export type ContactValue = { id?: string; full_name?: string | null; department?: string | null; email?: string | null; phone?: string | null };
export function ContactForm({ organizationId, companyId, contact }: { organizationId: string; companyId: string; contact?: ContactValue }) {
  const state = useSubmit(); async function action(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await state.submit(contact?.id ? `/api/contacts/${contact.id}` : "/api/contacts", contact?.id ? "PATCH" : "POST", { organizationId, companyId, fullName: form.get("fullName"), department: form.get("department"), email: form.get("email"), phone: form.get("phone") }); }
  return <form className="form-grid" onSubmit={action}><label className="field-label">氏名<input className="field" name="fullName" defaultValue={contact?.full_name ?? ""} /></label><label className="field-label">部署<input className="field" name="department" defaultValue={contact?.department ?? ""} /></label><label className="field-label">メール<input className="field" name="email" type="email" defaultValue={contact?.email ?? ""} /></label><label className="field-label">電話番号<input className="field" name="phone" type="tel" defaultValue={contact?.phone ?? ""} /></label><div className="sm:col-span-2"><FormStatus {...state} /></div></form>;
}

export function SalesHistoryForm({ organizationId, companyId }: { organizationId: string; companyId: string }) {
  const state = useSubmit(); async function action(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const element = event.currentTarget; const form = new FormData(element); const saved = await state.submit("/api/sales-history", "POST", { organizationId, companyId, occurredOn: form.get("occurredOn"), activityType: form.get("activityType"), outcome: form.get("outcome") || undefined, notes: form.get("notes") || undefined }); if (saved) element.reset(); }
  return <form className="form-grid" onSubmit={action}><label className="field-label">日付<input className="field" name="occurredOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label className="field-label">活動種別<select className="field" name="activityType"><option value="approach">アプローチ</option><option value="meeting">商談</option><option value="proposal">提案</option><option value="contract">契約</option><option value="past_project">過去案件</option></select></label><label className="field-label sm:col-span-2">結果<input className="field" name="outcome" placeholder="例：再提案、返信待ち、受注" maxLength={100} /></label><label className="field-label sm:col-span-2">備考<textarea className="field min-h-24" name="notes" maxLength={5000} /></label><div className="sm:col-span-2"><FormStatus {...state} /></div></form>;
}

export function EventForm({ organizationId, companyId }: { organizationId: string; companyId: string }) {
  const state = useSubmit(); async function action(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await state.submit("/api/events", "POST", { organizationId, companyId, eventType: form.get("eventType"), occurredOn: form.get("occurredOn") || null, title: form.get("title"), sourceUrl: form.get("sourceUrl") || undefined, summary: form.get("summary") || undefined }); }
  return <form className="form-grid" onSubmit={action}><label className="field-label">イベント種別<input className="field" name="eventType" placeholder="例：exhibition" required /></label><label className="field-label">イベント日<input className="field" name="occurredOn" type="date" /></label><label className="field-label sm:col-span-2">タイトル<input className="field" name="title" required /></label><label className="field-label sm:col-span-2">根拠URL<input className="field" name="sourceUrl" type="url" /></label><label className="field-label sm:col-span-2">概要<textarea className="field" name="summary" /></label><div className="sm:col-span-2"><FormStatus {...state} /></div></form>;
}

export function OrganizationForm() {
  const router = useRouter(); const state = useSubmit((data) => { if (data && typeof data === "object" && "id" in data) router.push(`/dashboard?organizationId=${String(data.id)}`); });
  async function action(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await state.submit("/api/organizations", "POST", { name: form.get("name") }); }
  return <form className="flex flex-col gap-3 sm:flex-row" onSubmit={action}><label className="field-label flex-1">新しい組織名<input className="field" name="name" required maxLength={200} placeholder="例：営業チーム" /></label><div className="self-end"><FormStatus {...state} /></div></form>;
}

export function TimingRuleForm({ organizationId }: { organizationId: string }) {
  const state = useSubmit(); async function action(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await state.submit("/api/timing-rules", "POST", { organizationId, name: form.get("name"), enabled: true, configuration: { eventType: form.get("eventType"), leadDays: Number(form.get("leadDays")), cooldownDays: Number(form.get("cooldownDays")) } }); }
  return <form className="form-grid" onSubmit={action}><label className="field-label sm:col-span-2">ルール名<input className="field" name="name" placeholder="例：展示会の事前営業" required /></label><label className="field-label">イベント種別<input className="field" name="eventType" placeholder="exhibition" required /></label><label className="field-label">何日前から営業するか<input className="field" name="leadDays" type="number" min="0" max="3650" defaultValue="90" required /></label><label className="field-label">前回営業から空ける日数<input className="field" name="cooldownDays" type="number" min="0" max="3650" defaultValue="14" required /></label><div className="sm:col-span-2"><FormStatus {...state} /></div></form>;
}
