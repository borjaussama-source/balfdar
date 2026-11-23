"use client";

import { FormEvent, useEffect, useState } from "react";
import { ImagePlus, Save, ShieldCheck, UserRound } from "lucide-react";

type Profile = { username: string; email: string; profileImage: string; updatedAt: string };

export default function ProfilePanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preview, setPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [forgotCurrentPassword, setForgotCurrentPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/profile", { cache: "no-store", signal: AbortSignal.timeout(10000) })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Impossible de charger le profil."); return result as Profile; })
      .then(result => { if (active) setProfile(result); })
      .catch(e => { if (active) setError(e instanceof Error && e.name === "TimeoutError" ? "Le chargement du profil a dépassé 10 secondes. Réessayez." : e instanceof Error ? e.message : "Impossible de charger le profil."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") ?? "");
    data.set("sessionPasswordReset", String(forgotCurrentPassword));
    if (newPassword && newPassword !== String(data.get("confirmPassword") ?? "")) { setError("La confirmation du nouveau mot de passe ne correspond pas."); setBusy(false); return; }
    const photo = data.get("profileImage");
    if (photo instanceof File && photo.size === 0) data.delete("profileImage");
    if (removePhoto) data.set("removeProfileImage", "true");
    try {
      const response = await fetch("/api/admin/profile", { method: "PATCH", body: data, signal: AbortSignal.timeout(30000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer le profil.");
      setProfile(result); setPreview(""); setRemovePhoto(false); setForgotCurrentPassword(false); form.reset(); (form.elements.namedItem("username") as HTMLInputElement).value = result.username; (form.elements.namedItem("email") as HTMLInputElement).value = result.email; setSuccess("Profil mis à jour. Vos nouveaux identifiants sont actifs.");
    } catch (e) { setError(e instanceof Error && e.name === "TimeoutError" ? "L’enregistrement a pris trop de temps. Vérifiez votre connexion puis réessayez." : e instanceof Error ? e.message : "Impossible d’enregistrer le profil."); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="profile-panel"><p className="admin-empty">Chargement du profil…</p></section>;
  if (!profile) return <section className="profile-panel"><div className="admin-alert" role="alert">{error || "Profil indisponible."}<button type="button" onClick={() => window.location.reload()}>RÉESSAYER</button></div></section>;
  const shownPhoto = preview || (!removePhoto ? profile.profileImage : "");

  return <section className="profile-panel">
    <div className="profile-card">
      <div className="profile-card-heading"><div><p className="section-label">COMPTE ADMINISTRATEUR</p><h2>Votre profil</h2><p>Modifiez vos informations de connexion et votre photo de profil.</p></div><ShieldCheck size={22}/></div>
      <div className="profile-avatar-row"><div className="profile-avatar">{shownPhoto ? <img src={shownPhoto} alt="Photo de profil"/> : profile.username ? profile.username.slice(0, 1).toUpperCase() : <UserRound/>}</div><div><strong>{profile.username}</strong><span>{profile.email}</span></div></div>
      {error && <div className="admin-alert" role="alert">{error}</div>}{success && <div className="admin-success" role="status">{success}</div>}
      <form className="profile-form" onSubmit={save}>
        <label>Nom d’utilisateur<input name="username" required minLength={2} maxLength={80} defaultValue={profile.username} autoComplete="nickname"/></label>
        <label>E-mail de connexion<input name="email" type="email" required maxLength={254} defaultValue={profile.email} autoComplete="username"/></label>
        <div className="profile-divider"><span>SÉCURITÉ</span><small>Le mot de passe actuel est requis pour changer l’e-mail ou le mot de passe.</small></div>
        {!forgotCurrentPassword && <label>Mot de passe actuel<input name="currentPassword" type="password" autoComplete="current-password"/></label>}
        <label className="profile-remove-photo"><input type="checkbox" checked={forgotCurrentPassword} onChange={event => setForgotCurrentPassword(event.target.checked)}/> J’ai oublié mon mot de passe actuel — je suis encore connecté à ce compte.</label>
        {forgotCurrentPassword && <p className="profile-session-note">Cette récupération est autorisée uniquement depuis votre session administrateur active. Elle ne modifie que le mot de passe.</p>}
        <div className="profile-fields-two"><label>Nouveau mot de passe<input name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" placeholder="12 caractères minimum" required={forgotCurrentPassword}/><small>{forgotCurrentPassword ? "Choisissez un nouveau mot de passe." : "Laissez vide pour le conserver."}</small></label><label>Confirmer le nouveau mot de passe<input name="confirmPassword" type="password" maxLength={128} autoComplete="new-password" required={forgotCurrentPassword}/></label></div>
        <div className="profile-divider"><span>PHOTO DE PROFIL</span><small>JPEG, PNG, WebP ou AVIF · 8 Mo maximum</small></div>
        <label className="profile-photo-upload"><ImagePlus size={17}/><span>Choisir une photo</span><input name="profileImage" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { const file = event.target.files?.[0]; setPreview(file ? URL.createObjectURL(file) : ""); setRemovePhoto(false); }}/></label>
        {profile.profileImage && <label className="profile-remove-photo"><input type="checkbox" checked={removePhoto} onChange={event => { setRemovePhoto(event.target.checked); if (event.target.checked) setPreview(""); }}/> Retirer la photo actuelle</label>}
        <button className="cta dark full" disabled={busy}><Save size={16}/>{busy ? "ENREGISTREMENT…" : "ENREGISTRER LE PROFIL"}</button>
      </form>
    </div>
  </section>;
}
