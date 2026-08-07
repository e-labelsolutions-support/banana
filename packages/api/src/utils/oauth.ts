import crypto from "crypto";

const SECRET = process.env.BETTER_AUTH_SECRET;
if (!SECRET) throw new Error("BETTER_AUTH_SECRET is required for OAuth state signing");

const KEY = crypto.createHash("sha256").update(String(SECRET)).digest();
const B64URL = "base64url";

export interface OAuthPkce {
  verifier: string;
  challenge: string;
  challengeMethod: "S256";
}

export function generatePkce(): OAuthPkce {
  const verifier = crypto.randomBytes(32).toString(B64URL);
  const challenge = crypto.createHash("sha256").update(verifier).digest(B64URL);
  return { verifier, challenge, challengeMethod: "S256" };
}

export interface SignedState {
  nonce: string;
  signature: string;
}

export function signState(payload: string): SignedState {
  const nonce = crypto.randomBytes(16).toString(B64URL);
  const signature = crypto
    .createHmac("sha256", KEY)
    .update(`${nonce}.${payload}`)
    .digest(B64URL);
  return { nonce, signature };
}

export function verifyState(payload: string, nonce: string, signature: string): boolean {
  if (!nonce || !signature) return false;
  const expected = crypto
    .createHmac("sha256", KEY)
    .update(`${nonce}.${payload}`)
    .digest(B64URL);
  return (
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}

export interface OAuthStateCookie {
  nonce: string;
  signature: string;
  verifier: string;
  userId: string;
}

export const encodeStateCookie = (cookie: OAuthStateCookie): string =>
  Buffer.from(JSON.stringify(cookie), "utf8").toString(B64URL);

export function decodeStateCookie(raw: string): OAuthStateCookie | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, B64URL).toString("utf8")) as Partial<OAuthStateCookie>;
    if (
      typeof parsed.nonce !== "string" ||
      typeof parsed.signature !== "string" ||
      typeof parsed.verifier !== "string" ||
      typeof parsed.userId !== "string"
    ) {
      return null;
    }
    return parsed as OAuthStateCookie;
  } catch {
    return null;
  }
}
