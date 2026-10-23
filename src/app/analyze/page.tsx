import { NewAnalysisForm } from "@/components/NewAnalysisForm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AnalyzePage() {
  const user = await requireUser();
  const resumes = await db.resume.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, fileName: true, label: true, createdAt: true },
    take: 20,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quick analysis</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Check a resume against a job ad without saving the job. To track an application, add it on the Jobs board
          instead.
        </p>
      </div>
      <NewAnalysisForm resumes={resumes} />
    </div>
  );
}
