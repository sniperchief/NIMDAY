import { route, ok } from "@/lib/http";
import { destroySession } from "@/lib/auth/session";

export const POST = route(async () => {
  await destroySession();
  return ok({ ok: true });
});
