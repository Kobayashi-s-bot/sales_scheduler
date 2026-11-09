import { AppShell } from "@/components/app-shell";
import { CompanyForm } from "@/components/data-forms";
import { requireOrganizationContext } from "@/lib/auth/server";
export const dynamic = "force-dynamic";
export default async function NewCompanyPage({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) { const { organizationId } = await searchParams; if (!organizationId) return null; const { organization } = await requireOrganizationContext(organizationId); return <AppShell organizationId={organizationId} organizationName={organization.name}><main className="page-container max-w-3xl"><p className="eyebrow">営業リスト</p><h1 className="mt-2 text-3xl font-bold">企業を追加</h1><section className="card mt-6 p-5 sm:p-7"><CompanyForm organizationId={organizationId} /></section></main></AppShell>; }
