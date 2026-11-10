import { createHash, timingSafeEqual } from "node:crypto";

const MIN_SECRET_LENGTH = 32;

export function verifyCronAuthorization(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH || !header) return false;
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  const expected = createHash("sha256").update(secret).digest();
  const supplied = createHash("sha256").update(match[1]).digest();
  return timingSafeEqual(expected, supplied) && match[1] === secret;
}
