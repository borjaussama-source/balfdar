import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAdminProfile, verifyAdminCredentials as verifyStoredCredentials } from "@/lib/products";

export const COOKIE_NAME = "akker_admin";
const SESSION_SECONDS = 60 * 60 * 8;
function secret() { const value = process.env.ADMIN_SESSION_SECRET; if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters."); return value; }
function signature(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }
export function validAdminCredentials(email: string, password: string) {
  try { return verifyStoredCredentials(email, password); } catch { return false; }
}
export function createAdminSession(email: string) {
  const payload = Buffer.from(`${email.toLowerCase()}|${Date.now() + SESSION_SECONDS * 1000}`).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export async function isAdmin() {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return false;
    const [payload, sig, extra] = token.split(".");
    if (!payload || !sig || extra) return false;
    const expected = Buffer.from(signature(payload)); const provided = Buffer.from(sig);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return false;
    const decoded = Buffer.from(payload, "base64url").toString("utf8").split("|");
    const email = decoded[0]; const expiry = Number(decoded[1]);
    return email === getAdminProfile()?.email && Number.isFinite(expiry) && expiry > Date.now();
  } catch { return false; }
}
