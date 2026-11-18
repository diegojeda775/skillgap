import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Tailored resumes now live on their job's page; old links land there. */
export default async function TailorRunPage({ params }: PageProps<"/tailor/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const run = await db.tailorRun.findFirst({ where: { id, userId: user.id }, select: { jobId: true, resultResumeId: true } });
  if (run?.jobId) redirect(`/jobs/${run.jobId}`);
  if (run?.resultResumeId) redirect(`/resumes/${run.resultResumeId}`);
  notFound();
}
