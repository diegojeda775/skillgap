import { SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { primaryButton } from "@/components/ui";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/jobs");
  return <Landing />;
}

function Landing() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Track every application. Close every skill gap.</h1>
      <p className="mx-auto mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
        Save job ads to a board, keep a resume version for each kind of role, and let three AI models show the
        keywords each employer screens for and which ones your resume is missing.
      </p>
      <div className="mt-8">
        <SignInButton mode="modal">
          <button className={primaryButton}>Get started</button>
        </SignInButton>
      </div>
    </div>
  );
}
