import { route, ok, unauthorized } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/currentUser";

export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return ok({ user: { walletAddress: user.walletAddress } });
});
