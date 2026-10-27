"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import InvoiceDocument, { type InvoiceDocumentData } from "@/components/invoice-document";
import type { InvoiceStatus } from "@/lib/products";

type AdminInvoice = InvoiceDocumentData & { sharePath: string };
const money = (value: number) => new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(value);

export default function AdminInvoicePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [invoice, setInvoice] = useState<AdminInvoice | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/invoices/" + encodeURIComponent(id), { cache: "no-store" })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(response.status === 401 ? "Connectez-vous à l’administration pour consulter cette facture." : result.error); return result; })
      .then(result => { if (active) setInvoice(result); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Impossible de charger la facture."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  async function updateStatus(status: InvoiceStatus) {
    if (!invoice) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/invoices/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Modification impossible.");
      setInvoice(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Modification impossible."); }
    finally { setBusy(false); }
  }
  function sendWhatsApp() {
    if (!invoice) return;
    const digits = invoice.phone.replace(/\D/g, "");
    const phone = digits.startsWith("00") ? digits.slice(2) : digits.startsWith("0") ? "212" + digits.slice(1) : digits;
    if (phone.length < 8 || phone.length > 15) { setError("Le numéro de téléphone de cette commande n’est pas valide."); return; }
    const text = [
      "Bonjour " + invoice.customerName, "",
      "Merci pour votre commande chez BALFDAR.",
      "Commande : #" + invoice.orderId,
      "Facture : " + invoice.invoiceNumber,
      "Montant total : " + money(invoice.totalMad),
      "Votre facture sécurisée : " + new URL(invoice.sharePath, window.location.origin).toString(),
      "",
      "Merci d’avoir choisi BALFDAR."
    ].join("\n");
    window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
  }
  if (loading) return <main className="admin-shell"><p className="admin-empty">Chargement de la facture…</p></main>;
  if (error && !invoice) return <main className="admin-shell"><a className="admin-back" href="/admin">← RETOUR À L’ADMINISTRATION</a><div className="admin-alert">{error}</div></main>;
  if (!invoice) return null;
  return <>{error && <div className="invoice-page-error no-print" role="alert">{error}<button onClick={() => setError("")} aria-label="Fermer">×</button></div>}<InvoiceDocument invoice={invoice} admin onStatusChange={status => void updateStatus(status)} onWhatsApp={sendWhatsApp} busy={busy}/></>;
}
