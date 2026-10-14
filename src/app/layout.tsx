import { ClerkProvider, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SkillGap",
  description: "Compare your resume to a job ad: get the keywords and the skill gaps.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { userId } = await auth();

  return (
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="flex min-h-full flex-col font-sans">
          <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <nav className="mx-auto flex h-14 max-w-4xl items-center gap-6 px-4">
              <Link href="/" className="font-semibold tracking-tight">
                SkillGap
              </Link>
              {userId && (
                <>
                  <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
                    New analysis
                  </Link>
                  <Link href="/analyses" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
                    History
                  </Link>
                </>
              )}
              <div className="ml-auto">
                {userId ? (
                  <UserButton />
                ) : (
                  <SignInButton mode="modal">
                    <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white dark:bg-white dark:text-neutral-900">
                      Sign in
                    </button>
                  </SignInButton>
                )}
              </div>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
