import Link from "next/link";
import { MonthlyCalendar } from "@/components/monthly-calendar";
import { AppShell } from "@/components/app-shell";
import { requireOrganizationContext } from "@/lib/auth/server";
import { calendarQuerySchema } from "@/lib/validation/sales";
export const dynamic = "force-dynamic";
function nextMonth(month: string) { const [year, value] = month.split("-").map(Number); return new Date(Date.UTC(year, value, 1)).toISOString().slice(0, 7); }
function shiftMonth(month: string, amount: number) { const [year, value] = month.split("-").map(Number); return new Date(Date.UTC(year, value - 1 + amount, 1)).toISOString().slice(0, 7); }
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ organizationId?: string; month?: string }> }) {
  const input = calendarQuerySchema.parse(await searchParams); const { supabase, organization } = await requireOrganizationContext(input.organizationId); const { data, error } = await supabase.from("sales_recommendations").select("id,recommended_on,reason,companies(id,name)").eq("organization_id", input.organizationId).gte("recommended_on", `${input.month}-01`).lt("recommended_on", `${nextMonth(input.month)}-01`).eq("status", "pending").order("recommended_on"); if (error) throw error;
  const items = (data ?? []).map(({ companies, ...item }) => ({ ...item, companies: Array.isArray(companies) ? (companies[0] ?? null) : companies }));
  return <AppShell organizationId={input.organizationId} organizationName={organization.name}><main className="page-container"><header className="mb-6 flex items-end justify-between gap-4"><div><p className="eyebrow">営業カレンダー</p><h1 className="mt-2 text-3xl font-bold">{input.month}</h1></div><nav className="flex gap-2"><Link className="secondary-button" href={`/calendar?organizationId=${input.organizationId}&month=${shiftMonth(input.month, -1)}`}>前月</Link><Link className="secondary-button" href={`/calendar?organizationId=${input.organizationId}&month=${shiftMonth(input.month, 1)}`}>翌月</Link></nav></header><MonthlyCalendar month={input.month} items={items} organizationId={input.organizationId} /></main></AppShell>;
}
