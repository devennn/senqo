import * as jose from "jose";

const ALGORITHM = "HS256";

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (!cachedSecret) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET environment variable is not set");
    cachedSecret = new TextEncoder().encode(secret);
  }
  return cachedSecret;
}

export async function signAccessToken(userId: string): Promise<string> {
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecret());
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new jose.SignJWT({ sub: userId, type: "refresh" })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret(), {
      algorithms: [ALGORITHM],
    });
    const sub = payload.sub;
    if (!sub || typeof sub !== "string") return null;
    return { userId: sub };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret(), {
      algorithms: [ALGORITHM],
    });
    if (payload.type !== "refresh") return null;
    const sub = payload.sub;
    if (!sub || typeof sub !== "string") return null;
    return { userId: sub };
  } catch {
    return null;
  }
}