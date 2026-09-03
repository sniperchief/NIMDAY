import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

const COOKIE_NAME = "nimday_session";
const ALG = "HS256";

export interface SessionPayload {
  userId: string;
  walletAddress: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret());
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const ttl = env.sessionTtlSeconds();
  const token = await new SignJWT({ walletAddress: payload.walletAddress })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: [ALG],
    });
    if (!payload.sub || typeof payload.walletAddress !== "string") return null;
    return { userId: payload.sub, walletAddress: payload.walletAddress };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
