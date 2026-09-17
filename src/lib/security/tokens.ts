import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
function key(value: string) {
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== 32)
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 random bytes in base64");
  return bytes;
}
export function encryptToken(token: string, secret: string, context: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), nonce);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    nonce.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function decryptToken(value: string, secret: string, context: string) {
  const [version, iv, tag, body, ...rest] = value.split(".");
  if (version !== "v1" || !iv || !tag || !body || rest.length)
    throw new Error("Invalid token envelope");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(secret),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
export function secureEqual(a: string, b: string) {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}
