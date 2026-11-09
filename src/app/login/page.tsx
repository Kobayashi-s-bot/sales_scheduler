import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function LoginPage() { const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser(); if (user) redirect("/organizations"); return <main className="min-h-screen px-5 py-12"><div className="mx-auto mb-8 max-w-md"><p className="eyebrow">営業カレンダー</p><h1 className="mt-2 text-3xl font-bold">営業の一日を始める</h1><p className="mt-2 text-stone-600">ログイン後、所属組織と今日の営業対象を確認できます。</p></div><AuthForm /></main>; }
