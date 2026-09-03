import { route, ok, unauthorized } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { getOwnBirthday, toEditorBirthday } from "@/lib/birthday";

export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const b = await getOwnBirthday(user.id);
  return ok({ birthday: b ? toEditorBirthday(b) : null });
});
