"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { suggestSourceType } from "@/lib/validation/public-source-type";

type PublicSource = { id: string; source_url: string; source_type: "rss" | "html"; last_checked_at: string | null; last_error: string | null };

export function PublicSourcesPanel({ organizationId, companyId, sources }: { organizationId: string; companyId: string; sources: PublicSource[] }) {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState<"rss" | "html">("html");
  const [manuallySelected, setManuallySelected] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/public-sources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, companyId, sourceUrl, sourceType }) });
      if (response.status === 201) {
        setSourceUrl("");
        setSourceType("html");
        setManuallySelected(false);
        router.refresh();
      } else if (response.status === 409) {
        setMessage("すでに登録されています");
      } else {
        setMessage("取得元を登録できませんでした。入力内容を確認してください。");
      }
    } catch {
      setMessage("取得元を登録できませんでした。時間をおいて再試行してください。");
    } finally {
      setPending(false);
    }
  }

  async function deleteSource(id: string) {
    if (!window.confirm("この取得元から取り込んだ記事の記録は消えます。採用前の候補は残ります。削除しますか？")) return;
    setMessage("");
    try {
      const query = `id=${encodeURIComponent(id)}&companyId=${encodeURIComponent(companyId)}&organizationId=${encodeURIComponent(organizationId)}`;
      const response = await fetch(`/api/public-sources?${query}`, { method: "DELETE" });
      if (response.status === 204) router.refresh();
      else setMessage("取得元を削除できませんでした。");
    } catch {
      setMessage("取得元を削除できませんでした。時間をおいて再試行してください。");
    }
  }

  return <section className="mt-7 card p-5"><h2 className="section-title">取得元</h2>
    {sources.length ? <ul className="mt-3 space-y-3">{sources.map((source) => <li className="flex flex-col gap-2 border-b border-stone-200 pb-3 sm:flex-row sm:items-start sm:justify-between" key={source.id}><div className="min-w-0 break-words"><p>{source.source_url}</p><p className="text-sm text-stone-600">種別：{source.source_type} · 最終取得：{source.last_checked_at ?? "未取得"}</p>{source.last_error ? <p className="form-error">{source.last_error}</p> : null}</div><button className="secondary-button self-start" type="button" onClick={() => void deleteSource(source.id)}>削除</button></li>)}</ul> : <p className="empty-state mt-3">取得元はありません</p>}
    <form className="form-grid mt-5" onSubmit={addSource}><label className="field-label sm:col-span-2">URL<input className="field" name="sourceUrl" type="url" value={sourceUrl} required maxLength={2048} onChange={(event) => { const nextUrl = event.target.value; setSourceUrl(nextUrl); if (!manuallySelected) setSourceType(suggestSourceType(nextUrl)); }} /></label><label className="field-label">種別<select className="field" name="sourceType" value={sourceType} onChange={(event) => { setSourceType(event.target.value as "rss" | "html"); setManuallySelected(true); }}><option value="rss">rss</option><option value="html">html</option></select></label><div className="sm:col-span-2"><button className="primary-button" type="submit" disabled={pending}>{pending ? "追加中…" : "追加"}</button>{message ? <p className="form-error mt-2" role="status">{message}</p> : null}</div></form>
  </section>;
}
