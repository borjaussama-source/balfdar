"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, MessageCircle, Search } from "lucide-react";
import type { InvoiceStatus, InvoiceSummary, OrderStatus } from "@/lib/products";

type InvoicePage = { invoices: InvoiceSummary[]; total: number; page: number; pageSize: number; pageCount: number; invoiceCount: number; invoiceValueMad: number };
const statuses: InvoiceStatus[] = ["Draft", "Generated", "Sent", "Paid", "Cancelled"];
const orders: OrderStatus[] = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Completed", "Cancelled"];
const statusLabels: Record<InvoiceStatus, string> = { Draft: "Brouillon", Generated: "Générée", Sent: "Envoyée", Paid: "Payée", Cancelled: "Annulée" };
const orderLabels: Record<OrderStatus, string> = { Pending: "En attente", Confirmed: "Confirmée", Processing: "En préparation", Shipped: "Expédiée", Delivered: "Livrée", Completed: "Terminée", Cancelled: "Annulée" };
const money = (n: number) => new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(n);
const day = (value: string) => new Date(value).toLocaleDateString("fr-MA", { year: "numeric", month: "short", day: "numeric" });

export default function InvoicesPanel() {
  const [data, setData] = useState<InvoicePage | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), pageSize: "20", q: query, status, orderStatus, from, to });
      try {
        const response = await fetch("/api/admin/invoices?" + params, { cache: "no-store", signal: AbortSignal.timeout(12000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Impossible de charger les factures.");
        if (active) { setData(result); setError(""); }
      } catch (e) {
        if (active) setError(e instanceof DOMException && e.name === "TimeoutError" ? "Le chargement des factures a dépassé 12 secondes." : e instanceof Error ? e.message : "Erreur de chargement.");
      } finally { if (active) setLoading(false); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, status, orderStatus, from, to, page, reloadKey]);

  async function updateStatus(invoice: InvoiceSummary, next: InvoiceStatus) {
    setBusyId(invoice.id); setError("");
    try {
      const response = await fetch("/api/admin/invoices/" + encodeURIComponent(invoice.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Modification impossible.");
      setData(current => current ? { ...current, invoices: current.invoices.map(item => item.id === invoice.id ? { ...item, status: result.status, orderStatus: result.orderStatus } : item) } : current);
    } catch (e) { setError(e instanceof Error ? e.message : "Modification impossible."); }
    finally { setBusyId(""); }
  }

  async function sendWhatsApp(invoice: InvoiceSummary) {
    setError("");
    const digits = invoice.phone.replace(/\D/g, "");
    const phone = digits.startsWith("00") ? digits.slice(2) : digits.startsWith("0") ? "212" + digits.slice(1) : digits;
    if (phone.length < 8 || phone.length > 15) { setError("Le numéro de téléphone de cette commande n’est pas valide."); return; }
    const popup = window.open("about:blank", "_blank");
    if (!popup) { setError("Autorisez l’ouverture d’un nouvel onglet pour WhatsApp."); return; }
    popup.opener = null;
    setBusyId(invoice.id);
    try {
      const response = await fetch("/api/admin/invoices/" + encodeURIComponent(invoice.id), { cache: "no-store" });
      const detail = await response.json();
      if (!response.ok) throw new Error(detail.error ?? "Impossible de préparer la facture.");
      const text = [
        "Bonjour " + invoice.customerName + ",",
        "",
        "Merci pour votre commande chez BALFDAR.",
        "Commande : #" + invoice.orderId,
        "Facture : " + invoice.invoiceNumber,
        "Montant total : " + money(invoice.totalMad),
        "Votre facture sécurisée : " + new URL(detail.sharePath, window.location.origin).toString(),
        "",
        "Merci d’avoir choisi BALFDAR."
      ].join("\n");
      popup.location.href = "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
    } catch (e) {
      popup.close();
      setError(e instanceof Error ? e.message : "WhatsApp n’a pas pu être ouvert.");
    } finally { setBusyId(""); }
  }

  return <section className="invoices-panel">
    <div className="invoice-summary">
      <div><span>FACTURES</span><strong>{data?.invoiceCount ?? "—"}</strong></div>
      <div><span>VALEUR FACTURÉE</span><strong>{data ? money(data.invoiceValueMad) : "—"}</strong></div>
      <div><span>RÉSULTATS</span><strong>{data?.total ?? "—"}</strong></div>
    </div>
    <p className="invoice-local-note">Les liens privés de facture sont accessibles aux clients lorsque la boutique est publiée sur une adresse Internet publique.</p>
    {error && <div className="admin-alert" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Fermer">×</button></div>}
    <div className="invoice-filters">
      <label className="invoice-search"><Search size={15}/><input aria-label="Rechercher une facture" placeholder="Nº facture, commande, client ou téléphone" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}/></label>
      <select aria-label="Filtrer par statut de facture" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Tous les statuts facture</option>{statuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select>
      <select aria-label="Filtrer par statut de commande" value={orderStatus} onChange={event => { setOrderStatus(event.target.value); setPage(1); }}><option value="">Tous les statuts commande</option>{orders.map(value => <option key={value} value={value}>{orderLabels[value]}</option>)}</select>
      <label className="invoice-date">Du <input type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }}/></label>
      <label className="invoice-date">Au <input type="date" value={to} onChange={event => { setTo(event.target.value); setPage(1); }}/></label>
    </div>
    {loading && !data ? <div className="admin-empty"><p>Chargement des factures…</p><button className="admin-cancel" onClick={() => { setLoading(false); setReloadKey(value => value + 1); }}>ANNULER ET RÉESSAYER</button></div> : error && !data ? <div className="invoice-empty"><FileText size={25}/><h2>Impossible de charger les factures</h2><p>{error}</p><button className="admin-cancel" onClick={() => setReloadKey(value => value + 1)}>RÉESSAYER</button></div> : !data?.invoices.length ? <div className="invoice-empty"><FileText size={25}/><h2>Aucune facture dans cette vue</h2><p>Chaque nouvelle commande enregistrée crée automatiquement sa facture.</p></div> :
      <div className="invoice-list">
        {data.invoices.map(invoice => <article className="invoice-list-row" key={invoice.id}>
          <div className="invoice-list-main"><div className="invoice-list-number"><FileText size={17}/><strong>{invoice.invoiceNumber}</strong><span className={"invoice-status invoice-status-" + invoice.status.toLowerCase()}>{statusLabels[invoice.status]}</span></div><p>{invoice.customerName} · commande <span title={invoice.orderId}>#{invoice.orderId.slice(0, 8)}</span></p><small>{day(invoice.issuedAt)} · {invoice.itemCount} article{invoice.itemCount === 1 ? "" : "s"} · {orderLabels[invoice.orderStatus ?? "Pending"]}</small></div>
          <div className="invoice-list-total"><strong>{money(invoice.totalMad)}</strong><span>{invoice.phone}</span></div>
          <div className="invoice-list-actions"><a className="invoice-row-action" href={"/admin/invoices/" + encodeURIComponent(invoice.id)}><ExternalLink size={14}/> VOIR</a><button className="invoice-row-action" onClick={() => void sendWhatsApp(invoice)} disabled={busyId === invoice.id}><MessageCircle size={14}/> WHATSAPP</button><label className="invoice-status-select"><span>STATUT</span><select value={invoice.status} disabled={busyId === invoice.id} onChange={event => void updateStatus(invoice, event.target.value as InvoiceStatus)}>{statuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label></div>
        </article>)}
      </div>}
    {data && data.pageCount > 1 && <div className="invoice-pagination"><span>{(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} sur {data.total}</span><button disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} aria-label="Page précédente"><ChevronLeft size={17}/></button><strong>Page {data.page} / {data.pageCount}</strong><button disabled={page >= data.pageCount} onClick={() => setPage(value => Math.min(data.pageCount, value + 1))} aria-label="Page suivante"><ChevronRight size={17}/></button></div>}
  </section>;
}
