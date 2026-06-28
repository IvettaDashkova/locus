import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

/**
 * Hash a password with scrypt (Node built-in — no extra dependency). The result is self-describing:
 * `scrypt$<saltHex>$<hashHex>`, so `verifyPassword` needs only the stored string.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Constant-time verify against a `hashPassword` output. Returns false on any malformed input. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scryptAsync(password, Buffer.from(saltHex, "hex"), KEYLEN)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
