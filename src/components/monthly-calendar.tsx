type CalendarItem = { id: string; recommended_on: string; reason: string; companies: { id: string; name: string } | null };

export function MonthlyCalendar({ month, items }: { month: string; items: CalendarItem[] }) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const byDay = new Map<number, CalendarItem[]>();
  for (const item of items) {
    const day = Number(item.recommended_on.slice(8, 10));
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }
  return (
    <section aria-label={`${month} 営業カレンダー`} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {Array.from({ length: days }, (_, index) => index + 1).map((day) => (
        <article key={day} className="min-h-28 rounded-md border bg-white p-3">
          <h2 className="text-sm font-semibold">{day}日</h2>
          <ul className="mt-2 space-y-2">
            {(byDay.get(day) ?? []).map((item) => <li key={item.id} className="rounded bg-teal-50 p-2 text-xs"><span className="font-semibold">{item.companies?.name ?? "企業"}</span><br />{item.reason}</li>)}
          </ul>
        </article>
      ))}
    </section>
  );
}
