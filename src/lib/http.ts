import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...extra } },
    { status },
  );
}

export const badRequest = (message = "Invalid request", extra?: Record<string, unknown>) =>
  fail(400, "bad_request", message, extra);
export const unauthorized = (message = "Sign in to continue") =>
  fail(401, "unauthorized", message);
export const forbidden = (message = "You can't edit this nimDay") =>
  fail(403, "forbidden", message);
export const notFound = (message = "Not found") => fail(404, "not_found", message);
export const conflict = (message: string, extra?: Record<string, unknown>) =>
  fail(409, "conflict", message, extra);
export const serverError = (message = "Something went wrong") =>
  fail(500, "server_error", message);

/** Parse + validate a JSON body. Throws a Response on failure (catch in the handler). */
export async function readJson<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Expected a JSON body");
  }
  try {
    return schema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      throw badRequest("Some details need fixing", {
        issues: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    throw badRequest();
  }
}

/** Wrap a route handler so thrown Responses and unexpected errors become clean JSON. */
export function route<A extends unknown[]>(
  handler: (req: Request, ...args: A) => Promise<Response>,
) {
  return async (req: Request, ...args: A): Promise<Response> => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      if (err instanceof Response) return err;
      console.error("[route error]", err);
      return serverError();
    }
  };
}
