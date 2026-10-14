import { SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { NewAnalysisForm } from "@/components/NewAnalysisForm";
import { primaryButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) return <Landing />;

  const user = await requireUser();
  const resumes = await db.resume.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, createdAt: true },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New analysis</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Claude, OpenAI and Gemini each read the job ad and check your resume. Their answers are merged into one
          deduplicated list.
        </p>
      </div>
      <NewAnalysisForm resumes={resumes} />
    </div>
  );
}

function Landing() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">See what a job wants that your resume doesn&apos;t show</h1>
      <p className="mx-auto mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
        Upload your resume and a job ad. Three AI models pull out every keyword the employer screens for and tell you
        which ones your resume is missing.
      </p>
      <div className="mt-8">
        <SignInButton mode="modal">
          <button className={primaryButton}>Get started</button>
        </SignInButton>
      </div>
    </div>
  );
}
