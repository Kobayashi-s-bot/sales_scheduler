import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-6 px-6">
      <p className="text-sm font-semibold tracking-widest text-teal-700">SALES SCHEDULER</p>
      <h1 className="text-4xl font-bold tracking-tight">営業判断を、安全なデータ基盤から。</h1>
      <p className="max-w-2xl text-neutral-600">
        Issue #2では認証、組織分離、データベースとセキュリティ境界を構築しています。
        営業スコアリングと公開情報収集は後続Issueで実装します。
      </p>
      <div><Button disabled>認証後に利用できます</Button></div>
    </main>
  );
}
