import { JobBoard, type JobCardData } from "@/components/jobs/JobBoard";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function JobsPage() {
  const user = await requireUser();

  const [jobs, masterCount, appliedCount, interviewCount, offerCount] = await Promise.all([
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
        resume: { select: { sourceResumeId: true } },
        matchScore: true,
      },
    }),
    db.resume.count({ where: { userId: user.id, isMaster: true } }),
    db.job.count({ where: { userId: user.id, appliedAt: { not: null } } }),
    db.job.count({ where: { userId: user.id, events: { some: { to: { in: ["INTERVIEWING", "OFFER"] } } } } }),
    db.job.count({ where: { userId: user.id, events: { some: { to: "OFFER" } } } }),
  ]);

  const cards: JobCardData[] = jobs.map((job) => ({
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
    // Only a resume made for this job is worth showing on its card.
    resumeLabel: job.resume?.sourceResumeId ? "Tailored resume" : null,
    match: job.matchScore === null ? null : { score: job.matchScore },
  }));

  return (
    <JobBoard
      jobs={cards}
      hasMaster={masterCount > 0}
      stats={{ applied: appliedCount, interviews: interviewCount, offers: offerCount }}
    />
  );
}
