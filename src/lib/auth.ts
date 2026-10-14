import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Returns the app's User row for the signed-in Clerk user, creating it on
 * first visit. Lazy creation avoids needing a Clerk webhook.
 */
export const requireUser = cache(async () => {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const existing = await db.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  return db.user.upsert({
    where: { clerkId: userId },
    update: {},
    create: {
      clerkId: userId,
      email: clerkUser?.primaryEmailAddress?.emailAddress ?? null,
    },
  });
});
