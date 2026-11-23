import { notFound } from "next/navigation";
import InvoiceDocument from "@/components/invoice-document";
import { getStoreInvoice } from "@/lib/store-backend";
import type { StoreInvoiceRecord } from "@/lib/store-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Votre facture BALFDAR", robots: { index: false, follow: false } };
type Props = { params: Promise<{ token: string }> };

export default async function SharedInvoicePage({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) notFound();
  const invoice = await getStoreInvoice(token) as StoreInvoiceRecord | null;
  if (!invoice) notFound();
  return <InvoiceDocument invoice={invoice} />;
}
