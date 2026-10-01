import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hash] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

interface TokenPayload { sub: string; email: string; permissions: string[]; roles: string[]; iat: number; exp: number; }
function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 8) throw new ServiceUnavailableException("JWT_SECRET deve possuir pelo menos 6 caracteres.");
  return value;
}
function encode(value: object) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
export function signToken(payload: Omit<TokenPayload, "iat" | "exp">) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode({ ...payload, iat: now, exp: now + 8 * 60 * 60 });
  const signature = createHmac("sha256", secret()).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}
export function verifyToken(token: string): TokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new UnauthorizedException("Token inválido.");
  const expected = createHmac("sha256", secret()).update(`${parts[0]}.${parts[1]}`).digest();
  const provided = Buffer.from(parts[2], "base64url");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) throw new UnauthorizedException("Token inválido.");
  let payload: TokenPayload;
  try { payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as TokenPayload; }
  catch { throw new UnauthorizedException("Token inválido."); }
  if (!payload.sub || payload.exp <= Math.floor(Date.now() / 1000)) throw new UnauthorizedException("Sessão expirada.");
  return payload;
}
