import { route, ok, unauthorized, badRequest } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  getStorage,
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/lib/storage";

/**
 * Image upload. Accepts multipart/form-data with a single `file` field.
 * Auth-gated so anonymous visitors can't fill storage. Returns { url }.
 */
export const POST = route(async (req) => {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return badRequest("Attach an image file");
  }
  if (!(file.type in ACCEPTED_IMAGE_TYPES)) {
    return badRequest("Use a JPG, PNG, WebP or GIF image");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return badRequest("That image is larger than 5 MB");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await getStorage().put(bytes, { contentType: file.type });
  return ok({ url: stored.url });
});
