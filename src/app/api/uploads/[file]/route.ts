import { notFound } from "@/lib/http";
import { getStorage } from "@/lib/storage";

type Ctx = { params: Promise<{ file: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { file } = await ctx.params;
  const found = await getStorage().get(file);
  if (!found) return notFound("Image not found");
  return new Response(new Uint8Array(found.bytes), {
    headers: {
      "Content-Type": found.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
