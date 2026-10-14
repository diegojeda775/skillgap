import Link from "next/link";
import { card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function HistoryPage() {
  const user = await requireUser();
  const analyses = await db.analysis.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      jobTitle: true,
      company: true,
      jobUrl: true,
      status: true,
      createdAt: true,
      resume: { select: { fileName: true } },
      _count: { select: { items: true } },
      items: { where: { status: { not: "MATCHED" }, importance: "REQUIRED" }, select: { id: true } },
    },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>
      {analyses.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          No analyses yet. <Link href="/" className="underline">Start one</Link>.
        </p>
      ) : (
        <ul className="space-y-3">
          {analyses.map((a) => (
            <li key={a.id}>
              <Link href={`/analyses/${a.id}`} className={`${card} block hover:border-neutral-400 dark:hover:border-neutral-600`}>
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-medium">
                    {a.jobTitle ?? "Untitled job"}
                    {a.company && <span className="font-normal text-neutral-500"> · {a.company}</span>}
                  </p>
                  <time className="shrink-0 text-xs text-neutral-500">{a.createdAt.toLocaleDateString()}</time>
                </div>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {a.status === "COMPLETE"
                    ? `${a._count.items} keywords · ${a.items.length} required gaps`
                    : a.status === "FAILED"
                      ? "Failed"
                      : "Running…"}
                  <span className="text-neutral-400"> · {a.resume.fileName}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
