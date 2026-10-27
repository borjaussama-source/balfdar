import { notFound } from "next/navigation";
import InvoiceDocument from "@/components/invoice-document";
import { getInvoiceByShareToken } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Votre facture BALFDAR", robots: { index: false, follow: false } };
type Props = { params: Promise<{ token: string }> };

export default async function SharedInvoicePage({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) notFound();
  const invoice = getInvoiceByShareToken(token);
  if (!invoice) notFound();
  const { shareToken: _shareToken, ...safeInvoice } = invoice;
  return <InvoiceDocument invoice={safeInvoice} />;
}
