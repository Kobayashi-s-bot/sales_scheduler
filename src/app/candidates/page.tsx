import { AppShell } from "@/components/app-shell";
import { CandidateActions } from "@/components/candidate-actions";
import { CandidateList, CandidateTabs, type CandidateView } from "@/components/candidate-review";
import { requireOrganizationContext } from "@/lib/auth/server";
import { parseCandidateStatus } from "@/lib/candidates/review";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  company_id: string;
  event_type: string;
  title: string;
  occurred_on: string | null;
  confidence: number | string | null;
  created_at: string;
  published_at: string | null;
  summary: string | null;
  source_url: string | null;
  companies: { id: string; name: string } | { id: string; name: string }[] | null;
};

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string | string[]; status?: string | string[] }>;
}) {
  const params = await searchParams;
  const organizationId = typeof params.organizationId === "string" ? params.organizationId : undefined;
  if (!organizationId) return <main className="p-8">組織を選択してください。</main>;

  const status = parseCandidateStatus(params.status);
  const { supabase, organization } = await requireOrganizationContext(organizationId);
  const { data, error } = await supabase
    .from("event_candidates")
    .select("id,company_id,event_type,title,occurred_on,confidence,created_at,published_at,summary,source_url,companies(id,name)")
    .eq("organization_id", organizationId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const candidates: CandidateView[] = rows.map((row) => {
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    return {
      id: row.id,
      company_name: company?.name ?? null,
      event_type: row.event_type,
      title: row.title,
      occurred_on: row.occurred_on,
      confidence: row.confidence,
      created_at: row.created_at,
      published_at: row.published_at,
      summary: row.summary,
      source_url: row.source_url,
    };
  });

  return (
    <AppShell organizationId={organizationId} organizationName={organization.name}>
      <main className="page-container">
        <header className="mb-6">
          <p className="eyebrow">{organization.name}</p>
          <h1 className="mt-2 text-3xl font-bold">候補レビュー</h1>
        </header>
        <CandidateTabs organizationId={organizationId} status={status} />
        {candidates.length === 100 ? <p className="mb-4 text-sm text-stone-600">最新100件を表示しています</p> : null}
        <CandidateList
          candidates={candidates}
          renderActions={
            status === "pending"
              ? (candidate) => <CandidateActions candidate={candidate} organizationId={organizationId} />
              : undefined
          }
        />
      </main>
    </AppShell>
  );
}
