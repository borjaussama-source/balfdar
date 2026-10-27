import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getInvoiceById, updateInvoiceStatus, type InvoiceStatus } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const statuses: InvoiceStatus[] = ["Draft", "Generated", "Sent", "Paid", "Cancelled"];
function adminInvoice(invoice: NonNullable<ReturnType<typeof getInvoiceById>>) {
  const { shareToken, ...safe } = invoice;
  return { ...safe, sharePath: "/invoice/" + shareToken };
}

export async function GET(_request: NextRequest, { params }: Context) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  const invoice = getInvoiceById(id);
  if (!invoice) return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });
  return NextResponse.json(adminInvoice(invoice), { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  let data: unknown;
  try { data = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  if (!data || typeof data !== "object" || !statuses.includes((data as { status?: InvoiceStatus }).status as InvoiceStatus)) {
    return NextResponse.json({ error: "Statut de facture invalide." }, { status: 400 });
  }
  try {
    const { id } = await params;
    const invoice = updateInvoiceStatus(id, (data as { status: InvoiceStatus }).status);
    if (!invoice) return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });
    return NextResponse.json(adminInvoice(invoice), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mise à jour impossible." }, { status: 409 });
  }
}
