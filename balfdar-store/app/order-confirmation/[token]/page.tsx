"use client";
import { useEffect, useState } from "react";

export default function OrderConfirmationPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [orderId, setOrderId] = useState("");
  const [state, setState] = useState<"loading"|"ready"|"done"|"invalid"|"error">("loading");
  useEffect(() => { let active = true; void params.then(async ({ token: value }) => { if (!active) return; setToken(value); try { const response = await fetch(`/api/order-confirmation/${encodeURIComponent(value)}`, { cache: "no-store" }); const data = await response.json(); if (!active) return; if (!response.ok || !data.valid) setState("invalid"); else { setOrderId(data.orderId); setState("ready"); } } catch { if (active) setState("error"); } }); return () => { active = false; }; }, [params]);
  async function confirm() { setState("loading"); try { const response = await fetch(`/api/order-confirmation/${encodeURIComponent(token)}`, { method: "POST" }); if (!response.ok) { setState("invalid"); return; } setState("done"); } catch { setState("error"); } }
  return <main className="customer-confirmation-page"><section className="customer-confirmation-card"><a href="/" className="customer-confirmation-brand"><img src="/balfdar-logo.png" alt="BALFDAR"/></a>{state === "loading" ? <p role="status">Vérification du lien…</p> : state === "done" ? <><h1>Merci !</h1><p>La réception de votre commande a bien été confirmée.</p></> : state === "invalid" ? <><h1>Lien indisponible</h1><p>Ce lien de confirmation est invalide, a expiré ou a déjà été utilisé. Votre commande reste enregistrée.</p></> : state === "error" ? <><h1>Connexion impossible</h1><p>Réessayez dans un instant.</p><button onClick={() => window.location.reload()}>RÉESSAYER</button></> : <><p className="section-label">COMMANDE #{orderId}</p><h1>Votre commande a été livrée.</h1><p>Confirmez la réception de votre commande BALFDAR.</p><button onClick={() => void confirm()}>CONFIRMER LA RÉCEPTION</button></>}</section></main>;
}
