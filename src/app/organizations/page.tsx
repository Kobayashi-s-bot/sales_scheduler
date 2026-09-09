import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { OrganizationForm } from "@/components/data-forms";
export const dynamic = "force-dynamic";
export default async function OrganizationsPage() {
  const { supabase } = await requireUser(); const { data: memberships, error } = await supabase.from("organization_members").select("organization_id,role,organizations(id,name)").order("created_at"); if (error) throw error;
  return <main className="mx-auto max-w-3xl px-5 py-10"><p className="eyebrow">組織選択</p><h1 className="mt-2 text-3xl font-bold">利用する組織を選ぶ</h1><div className="mt-8 grid gap-3">{(memberships ?? []).map((membership) => { const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations; return org ? <Link className="card flex items-center justify-between p-5 hover:border-teal-600" href={`/dashboard?organizationId=${org.id}`} key={membership.organization_id}><span className="font-semibold">{org.name}</span><span className="text-sm text-stone-500">{membership.role}</span></Link> : null; })}</div>{!memberships?.length ? <div className="empty-state mt-8"><h2>最初の組織を作成しましょう</h2><p>作成後、企業登録から始められます。</p></div> : null}<section className="card mt-8 p-5"><h2 className="mb-4 text-lg font-semibold">組織を作成</h2><OrganizationForm /></section></main>;
}
