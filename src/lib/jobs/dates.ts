// Follow-up dates are calendar days stored as noon UTC, so compare and format them by their UTC date.

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export type DueState = "overdue" | "today" | "upcoming";

export function dueState(iso: string): DueState {
  const day = iso.slice(0, 10);
  const today = localToday();
  return day < today ? "overdue" : day === today ? "today" : "upcoming";
}

export function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "YYYY-MM-DD" for a date input. */
export function toDateInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
