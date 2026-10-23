import { ClerkProvider, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
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
        <body className="flex min-h-full flex-col overflow-x-clip font-sans">
          <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <nav className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
              <Link href="/" className="shrink-0 font-semibold tracking-tight">
                SkillGap
              </Link>
              {userId && <NavLinks />}
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
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
