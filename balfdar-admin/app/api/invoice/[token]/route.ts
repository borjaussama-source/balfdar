import { NextResponse } from "next/server";
import { getInvoiceByShareToken } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Context) {
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });
  const invoice = getInvoiceByShareToken(token);
  if (!invoice) return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });
  const { shareToken: _shareToken, ...safeInvoice } = invoice;
  return NextResponse.json(safeInvoice, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
