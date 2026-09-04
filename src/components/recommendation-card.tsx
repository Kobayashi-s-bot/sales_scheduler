export type RecommendationView = {
  recommended_on: string;
  reason: string;
  status: string;
  evidence?: { sourceUrl?: string | null } | null;
};

export function RecommendationCard({ recommendation }: { recommendation: RecommendationView }) {
  return (
    <article className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-teal-700">次回アプローチ推奨日</p>
      <time className="mt-1 block text-2xl font-bold" dateTime={recommendation.recommended_on}>{recommendation.recommended_on}</time>
      <p className="mt-2 text-sm text-neutral-700">{recommendation.reason}</p>
      {recommendation.evidence?.sourceUrl ? <a className="mt-3 inline-block text-sm text-teal-700 underline" href={recommendation.evidence.sourceUrl} rel="noreferrer" target="_blank">根拠URLを確認</a> : null}
    </article>
  );
}
