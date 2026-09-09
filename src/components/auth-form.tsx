"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget); const email = String(form.get("email")); const password = String(form.get("password"));
    const supabase = createSupabaseBrowserClient();
    const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    setPending(false);
    if (result.error) return setError("ログインできませんでした。入力内容を確認してください。");
    if (mode === "signup" && !result.data.session) return setError("確認メールを送信しました。メール内のリンクから登録を完了してください。");
    router.push("/organizations"); router.refresh();
  }
  return <div className="card mx-auto max-w-md p-6 sm:p-8"><div className="mb-6 flex rounded-xl bg-stone-100 p-1"><button className={`tab ${mode === "login" ? "tab-active" : ""}`} onClick={() => setMode("login")}>ログイン</button><button className={`tab ${mode === "signup" ? "tab-active" : ""}`} onClick={() => setMode("signup")}>新規登録</button></div><form className="space-y-4" onSubmit={submit}><label className="field-label">メールアドレス<input className="field" name="email" type="email" autoComplete="email" required /></label><label className="field-label">パスワード<input className="field" name="password" type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="primary-button w-full" disabled={pending}>{pending ? "処理中…" : mode === "login" ? "ログイン" : "アカウントを作成"}</button></form></div>;
}
