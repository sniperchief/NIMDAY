import "server-only";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth/session";

export interface CurrentUser {
  id: string;
  walletAddress: string;
}

/** Resolve the authenticated user from the session cookie, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;
  return { id: user.id, walletAddress: user.walletAddress };
}
