import { MonthlyCalendar } from "@/components/monthly-calendar";
import { requireOrganizationMembership } from "@/lib/auth/server";
import { calendarQuerySchema } from "@/lib/validation/sales";

export const dynamic = "force-dynamic";

function nextMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value, 1)).toISOString().slice(0, 7);
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ organizationId?: string; month?: string }> }) {
  const query = await searchParams;
  const input = calendarQuerySchema.parse(query);
  const { supabase } = await requireOrganizationMembership(input.organizationId);
  const { data, error } = await supabase.from("sales_recommendations").select("id,recommended_on,reason,companies(id,name)").eq("organization_id", input.organizationId).gte("recommended_on", `${input.month}-01`).lt("recommended_on", `${nextMonth(input.month)}-01`).eq("status", "pending").order("recommended_on");
  if (error) throw error;
  const items = (data ?? []).map(({ companies, ...item }) => ({
    ...item,
    companies: Array.isArray(companies) ? (companies[0] ?? null) : companies,
  }));
  return <main className="mx-auto max-w-7xl px-6 py-10"><header className="mb-6"><p className="text-sm text-teal-700">営業カレンダー</p><h1 className="text-3xl font-bold">{input.month}</h1></header><MonthlyCalendar month={input.month} items={items} /></main>;
}
