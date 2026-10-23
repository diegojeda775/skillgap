import { JobBoard, type JobCardData } from "@/components/jobs/JobBoard";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resumeLabel } from "@/lib/resume/label";

export default async function JobsPage() {
  const user = await requireUser();

  const [jobs, resumes, appliedCount, interviewCount, offerCount] = await Promise.all([
    db.job.findMany({
      where: { userId: user.id },
      orderBy: { position: "asc" },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        stage: true,
        position: true,
        outcome: true,
        nextAction: true,
        nextActionAt: true,
        stageChangedAt: true,
        resume: { select: { label: true, fileName: true } },
        analyses: {
          where: { status: "COMPLETE" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { items: { where: { importance: "REQUIRED" }, select: { status: true } } },
        },
      },
    }),
    db.resume.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, label: true, fileName: true },
    }),
    db.job.count({ where: { userId: user.id, appliedAt: { not: null } } }),
    db.job.count({ where: { userId: user.id, events: { some: { to: { in: ["INTERVIEWING", "OFFER"] } } } } }),
    db.job.count({ where: { userId: user.id, events: { some: { to: "OFFER" } } } }),
  ]);

  const cards: JobCardData[] = jobs.map((job) => {
    const required = job.analyses[0]?.items;
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      stage: job.stage,
      position: job.position,
      outcome: job.outcome,
      nextAction: job.nextAction,
      nextActionAt: job.nextActionAt?.toISOString() ?? null,
      stageChangedAt: job.stageChangedAt.toISOString(),
      resumeLabel: job.resume ? resumeLabel(job.resume) : null,
      match: required?.length
        ? {
            score: Math.round(
              (100 * required.reduce((sum, i) => sum + (i.status === "MATCHED" ? 1 : i.status === "PARTIAL" ? 0.5 : 0), 0)) /
                required.length,
            ),
          }
        : null,
    };
  });

  return (
    <JobBoard
      jobs={cards}
      resumes={resumes.map((r) => ({ id: r.id, label: resumeLabel(r) }))}
      stats={{ applied: appliedCount, interviews: interviewCount, offers: offerCount }}
    />
  );
}
