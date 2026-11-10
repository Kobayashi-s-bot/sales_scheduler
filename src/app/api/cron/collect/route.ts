import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { HtmlSourceAdapter, RssSourceAdapter } from "@/lib/collection/adapters";
import { HeuristicEventAnalyzer } from "@/lib/collection/analyzer";
import { verifyCronAuthorization } from "@/lib/collection/cron-auth";
import { runScheduledCollection } from "@/lib/collection/scheduled";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const result = await runScheduledCollection({
      supabase,
      createAdapter: (type) => type === "rss" ? new RssSourceAdapter() : new HtmlSourceAdapter(),
      analyzer: new HeuristicEventAnalyzer(),
    });
    return Response.json({ data: result });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
