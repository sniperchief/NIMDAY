import { route, ok, unauthorized } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { getCreatorDashboard } from "@/lib/dashboard";

/** The creator's own "My NIMday" data. Scoped to the session's own birthday. */
export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const dashboard = await getCreatorDashboard(user.id);
  return ok({ dashboard });
});
