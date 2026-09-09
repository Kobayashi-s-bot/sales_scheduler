import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function Home() {
  const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/organizations");
  return <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-5 py-16"><p className="eyebrow">SALES SCHEDULER</p><h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">今日連絡すべき企業が、ひと目で分かる。</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600">企業・担当者・営業履歴を安全にまとめ、イベント前の最適な営業開始日をカレンダーへ整理します。</p><div className="mt-8"><Link className="primary-button inline-flex" href="/login">無料で利用を始める</Link></div></main>;
}
