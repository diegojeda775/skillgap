"use client";

import { History, KanbanSquare, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/jobs", label: "Jobs", icon: KanbanSquare, also: [] as string[] },
  { href: "/profile", label: "Profile", icon: UserRound, also: ["/resumes"] },
  { href: "/analyses", label: "History", icon: History, also: ["/analyze"] },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {LINKS.map(({ href, label, icon: Icon, also }) => {
        const active = [href, ...also].some((p) => pathname === p || pathname.startsWith(`${p}/`));
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
              active
                ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white"
                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-white"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
