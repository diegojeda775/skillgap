import { redirect } from "next/navigation";

/** Resumes are managed on the Profile page. */
export default function ResumesPage() {
  redirect("/profile");
}
