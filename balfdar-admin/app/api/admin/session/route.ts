import { NextRequest, NextResponse } from "next/server";
import { authenticateAdminAccount, COOKIE_NAME, createAdminSession, getCurrentAdmin } from "@/lib/admin-auth";

const attempts = new Map<string, { count: number; since: number }>();
export async function GET() {
  const user=await getCurrentAdmin();
  return NextResponse.json({authenticated:Boolean(user),user:user?{id:user.id,email:user.email,username:user.username,role:user.role,permissions:user.permissions}:null},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  // Do not trust the caller-controlled forwarded-for header as a rate-limit key.
  const ip = "admin-login";
  const now = Date.now(); const prior = attempts.get(ip);
  if (prior && now - prior.since < 10 * 60_000 && prior.count >= 10) return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  if (prior && now - prior.since < 10 * 60_000) prior.count += 1; else attempts.set(ip, { count: 1, since: now });
  const email = typeof body.email === "string" ? body.email.slice(0, 254) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 1024) : "";
  const account=authenticateAdminAccount(email,password);
  if (!account) return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
  attempts.delete(ip);
  const response = NextResponse.json({ authenticated: true,user:{id:account.id,email:account.email,username:account.username,role:account.role,permissions:account.permissions} });
  response.cookies.set(COOKIE_NAME, createAdminSession(account), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
  return response;
}
export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
