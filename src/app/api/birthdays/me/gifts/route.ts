import { route, ok, unauthorized } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { getOwnBirthday } from "@/lib/birthday";
import { getGiftActivity } from "@/lib/gifts/activity";

/** Gift activity for the authenticated creator's own nimDay. */
export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const birthday = await getOwnBirthday(user.id);
  if (!birthday) return ok({ activity: { items: [], totals: { giftCount: 0, totalNim: "0" } } });

  const activity = await getGiftActivity(birthday.id);
  return ok({ activity });
});
