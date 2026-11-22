import type { CoverLetterStatus } from "@/generated/prisma/enums";

// Longer than the slowest run; past this the server was stopped while it was writing.
const STUCK_AFTER_MS = 20 * 60 * 1000;

/** The letter's status, counting one that was interrupted as failed. */
export function letterStatus(letter: { status: CoverLetterStatus; createdAt: Date }): CoverLetterStatus {
  const stuck = letter.status === "WRITING" && Date.now() - letter.createdAt.getTime() > STUCK_AFTER_MS;
  return stuck ? "FAILED" : letter.status;
}
