"use client";

import { Printer } from "lucide-react";
import type { InvoiceRecord, InvoiceStatus } from "@/lib/products";

export type InvoiceDocumentData = Omit<InvoiceRecord, "shareToken">;
const money = (amount: number) => new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 2 }).format(amount);
const invoiceLabels: Record<InvoiceStatus, string> = { Draft: "Brouillon", Generated: "Générée", Sent: "Envoyée", Paid: "Payée", Cancelled: "Annulée" };
const orderLabels: Record<string, string> = { Pending: "En attente", Confirmed: "Confirmée", Processing: "En préparation", Shipped: "Expédiée", Delivered: "Livrée", Cancelled: "Annulée" };
const dateLabel = (value: string) => new Intl.DateTimeFormat("fr-MA", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(new Date(value));

export default function InvoiceDocument({ invoice, admin = false, onStatusChange, onWhatsApp, busy = false }: {
  invoice: InvoiceDocumentData;
  admin?: boolean;
  onStatusChange?: (status: InvoiceStatus) => void;
  onWhatsApp?: () => void;
  busy?: boolean;
}) {
  return <main className="invoice-view">
    <div className="invoice-toolbar no-print">
      {admin && <a className="invoice-back" href="/admin?section=invoices">← RETOUR AUX FACTURES</a>}
      <span>Pour enregistrer le PDF, choisissez « Enregistrer au format PDF » dans la fenêtre d’impression.</span>
      {admin && onStatusChange && <label className="invoice-status-control">STATUT
        <select value={invoice.status} onChange={event => onStatusChange(event.target.value as InvoiceStatus)} disabled={busy}>
          {Object.entries(invoiceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>}
      {admin && onWhatsApp && <button className="invoice-action invoice-whatsapp" type="button" onClick={onWhatsApp}>ENVOYER VIA WHATSAPP</button>}
      <button className="invoice-action" type="button" onClick={() => window.print()}><Printer size={15}/> TÉLÉCHARGER PDF / IMPRIMER</button>
    </div>
    <article className="invoice-paper">
      <header className="invoice-header">
        <div className="invoice-issuer">
          <img src="/balfdar-logo.png" alt="BALFDAR"/>
          <p><strong>BALFDAR · Mode contemporaine</strong><br/>Casablanca, Maroc<br/><a href="https://wa.me/212611923996">+212 611 923996</a></p>
        </div>
        <div className="invoice-heading">
          <h1>FACTURE</h1>
          <p><span>Nº de facture :</span> <strong>{invoice.invoiceNumber}</strong></p>
          <p><span>Référence commande :</span> <strong>{invoice.orderId}</strong></p>
          <p><span>Date :</span> <strong>{dateLabel(invoice.issuedAt)}</strong></p>
          <span className={"invoice-status invoice-status-" + invoice.status.toLowerCase()}>{invoiceLabels[invoice.status]}</span>
        </div>
      </header>
      <div className="invoice-rule"/>
      <section className="invoice-parties">
        <div>
          <h2>FACTURÉ À</h2>
          <strong className="invoice-customer">{invoice.customerName}</strong>
          <p>{invoice.phone}</p>
          {invoice.email && <p>{invoice.email}</p>}
          {invoice.address && <p>{invoice.address}</p>}
          {invoice.city && <p>{invoice.city}, Maroc</p>}
        </div>
        <div>
          <h2>RÉFÉRENCE DE COMMANDE</h2>
          <p>Commande : <strong>{invoice.orderId}</strong></p>
          <p>Mode de paiement : <strong>{invoice.paymentMethod}</strong></p>
          <p>Statut de commande : <strong>{invoice.orderStatus ? orderLabels[invoice.orderStatus] ?? invoice.orderStatus : "Commande archivée"}</strong></p>
        </div>
      </section>
      <div className="invoice-table-wrap">
        <table className="invoice-table">
          <thead><tr><th>Description</th><th>Qté</th><th>Prix unitaire</th><th>Montant</th></tr></thead>
          <tbody>{invoice.items.map(item => <tr key={item.id}>
            <td><div className="invoice-product">{item.productImage && <img src={item.productImage} alt=""/>}<div><strong>{item.productName}</strong>{item.sku && <small>Réf. {item.sku}</small>}{item.size && <small>Taille : {item.size}</small>}</div></div></td>
            <td>{item.quantity}</td>
            <td>{money(item.unitPriceMad)}</td>
            <td><strong>{money(item.totalPriceMad)}</strong></td>
          </tr>)}</tbody>
        </table>
      </div>
      <section className="invoice-totals">
        <div className="invoice-total-line"><span>Sous-total</span><strong>{money(invoice.subtotalMad)}</strong></div>
        {invoice.shippingCostMad > 0 && <div className="invoice-total-line"><span>Livraison</span><strong>{money(invoice.shippingCostMad)}</strong></div>}
        {invoice.discountMad > 0 && <div className="invoice-total-line"><span>Réduction</span><strong>− {money(invoice.discountMad)}</strong></div>}
        {invoice.taxMad > 0 && <div className="invoice-total-line"><span>Taxe</span><strong>{money(invoice.taxMad)}</strong></div>}
        <div className="invoice-total-due"><span>Total à payer</span><strong>{money(invoice.totalMad)}</strong></div>
      </section>
      <footer className="invoice-footer">
        <h2>CONDITIONS DE PAIEMENT</h2>
        <p>{invoice.paymentMethod}. Le règlement sera confirmé par l’équipe BALFDAR lors de la confirmation de commande.</p>
        <div className="invoice-footer-note">Merci d’avoir choisi BALFDAR.</div>
      </footer>
    </article>
  </main>;
}
