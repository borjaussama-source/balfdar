import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, createAdminSession, isAdmin } from "@/lib/admin-auth";
import { getAdminProfile, removeImages, storeImages, updateAdminProfile, verifyAdminPassword } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const profile = getAdminProfile();
  if (!profile) return NextResponse.json({ error: "Profil administrateur indisponible." }, { status: 503 });
  return NextResponse.json(profile, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 }); }
    catch { return NextResponse.json({ error: "Requête invalide." }, { status: 403 }); }
  }
  const current = getAdminProfile();
  if (!current) return NextResponse.json({ error: "Profil administrateur indisponible." }, { status: 503 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 }); }
  const username = String(form.get("username") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const currentPassword = String(form.get("currentPassword") ?? "");
  const newPassword = String(form.get("newPassword") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");
  const sessionPasswordReset = form.get("sessionPasswordReset") === "true";
  const image = form.get("profileImage");
  const removePhoto = form.get("removeProfileImage") === "true";
  if (username.length < 2 || username.length > 80) return NextResponse.json({ error: "Le nom doit contenir entre 2 et 80 caractères." }, { status: 400 });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Saisissez une adresse e-mail valide." }, { status: 400 });
  const credentialsChange = email !== current.email || newPassword.length > 0;
  if (sessionPasswordReset && (email !== current.email || !newPassword)) return NextResponse.json({ error: "La récupération de session sert uniquement à définir un nouveau mot de passe." }, { status: 400 });
  if (credentialsChange && !sessionPasswordReset && !verifyAdminPassword(currentPassword)) return NextResponse.json({ error: "Saisissez votre mot de passe actuel pour modifier vos identifiants." }, { status: 400 });
  if (newPassword && (newPassword.length < 12 || newPassword.length > 128)) return NextResponse.json({ error: "Le nouveau mot de passe doit contenir entre 12 et 128 caractères." }, { status: 400 });
  if (newPassword !== confirmPassword) return NextResponse.json({ error: "La confirmation du nouveau mot de passe ne correspond pas." }, { status: 400 });
  if (image && (!(image instanceof File) || image.size > 8 * 1024 * 1024)) return NextResponse.json({ error: "La photo doit être un fichier image de 8 Mo maximum." }, { status: 400 });
  let uploaded: string[] = [];
  try {
    if (image instanceof File && image.size > 0) uploaded = await storeImages([image]);
    const updated = updateAdminProfile({ username, email, newPassword: newPassword || undefined, profileImage: uploaded[0] ?? (removePhoto ? "" : undefined) });
    if ((uploaded.length || removePhoto) && current.profileImage) await removeImages([current.profileImage]).catch(() => {});
    const response = NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(COOKIE_NAME, createAdminSession(updated.email), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
    return response;
  } catch (error) {
    if (uploaded.length) await removeImages(uploaded).catch(() => {});
    const message = error instanceof Error && error.message.includes("UNIQUE constraint failed") ? "Cette adresse e-mail est déjà utilisée." : error instanceof Error ? error.message : "Impossible d’enregistrer le profil.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
