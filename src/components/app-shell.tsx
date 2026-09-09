"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AppShell({ organizationId, organizationName, children }: { organizationId: string; organizationName?: string; children: React.ReactNode }) {
  const router = useRouter();
  const links = [{ href: `/dashboard?organizationId=${organizationId}`, label: "営業対象" }, { href: `/companies?organizationId=${organizationId}`, label: "企業" }, { href: `/calendar?organizationId=${organizationId}&month=${new Date().toISOString().slice(0, 7)}`, label: "カレンダー" }];
  async function logout() { await createSupabaseBrowserClient().auth.signOut(); router.push("/login"); router.refresh(); }
  return <div className="min-h-screen pb-20 md:pb-0"><header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3"><Link className="font-bold tracking-tight" href={links[0].href}>営業カレンダー</Link><nav className="hidden items-center gap-6 md:flex">{links.map((link) => <Link className="nav-link" href={link.href} key={link.href}>{link.label}</Link>)}<Link className="nav-link" href={`/settings?organizationId=${organizationId}`}>ルール</Link><Link className="nav-link" href="/organizations">{organizationName ?? "組織切替"}</Link><button className="secondary-button" onClick={logout}>ログアウト</button></nav></div></header>{children}<nav aria-label="モバイルナビゲーション" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-white md:hidden">{links.map((link) => <Link className="px-2 py-3 text-center text-xs font-semibold text-stone-700" href={link.href} key={link.href}>{link.label}</Link>)}</nav></div>;
}
