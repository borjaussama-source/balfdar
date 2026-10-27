import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { countNewOrders, deleteOrder, getOrderById, getOrderMessageTemplates, listOrders, markOrderReviewed, prepareOrderConfirmation, setOrderWhatsAppState, updateOrder, type CustomerOrder, type OrderMessageEvent, type OrderStatus } from "@/lib/products";
import { applyCurrentBranding, renderOrderMessage, whatsappLink } from "@/lib/order-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const statuses: OrderStatus[] = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Completed", "Cancelled"];
const messageEvents: OrderMessageEvent[] = ["new_order", "delivered", "completed"];
function eventMessage(order: CustomerOrder, template: string, event: OrderMessageEvent, confirmationLink = "") {
  const message = renderOrderMessage(template, order, confirmationLink);
  return { message, url: whatsappLink(order.phone, message), event };
}
function originMatches(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (request.nextUrl.searchParams.get("summary") === "1") return NextResponse.json({ newCount: countNewOrders() }, { headers: { "Cache-Control": "no-store" } });
  const savedTemplates = getOrderMessageTemplates();
  const templates = Object.fromEntries(Object.entries(savedTemplates).map(([event, template]) => [event, applyCurrentBranding(template)])) as typeof savedTemplates;
  const orders = listOrders().map(order => ({
    ...order,
    whatsappOrder: eventMessage(order, templates.new_order, "new_order"),
    whatsappCompleted: order.status === "Completed" ? eventMessage(order, templates.completed, "completed") : null,
  }));
  return NextResponse.json({ orders, newCount: countNewOrders(), templates }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  if (!originMatches(request)) return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const data = body as { id?: unknown; event?: unknown };
  if (typeof data?.id !== "string" || data.id.length > 64 || !messageEvents.includes(data.event as OrderMessageEvent)) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  try {
    let order = getOrderById(data.id);
    if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    let confirmationLink = "";
    let confirmationExpiresAt: string | null = null;
    if (data.event === "delivered") {
      const prepared = prepareOrderConfirmation(data.id);
      order = prepared.order;
      confirmationExpiresAt = prepared.expiresAt;
      const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
      confirmationLink = `${site.replace(/\/$/, "")}/order-confirmation/${prepared.token}`;
    }
    if (data.event === "completed" && order.status !== "Completed") return NextResponse.json({ error: "La confirmation de fin est disponible après clôture de la commande." }, { status: 409 });
    const template = getOrderMessageTemplates()[data.event as OrderMessageEvent];
    const message = renderOrderMessage(template, order, confirmationLink);
    const url = whatsappLink(order.phone, message);
    setOrderWhatsAppState(order.id, data.event as OrderMessageEvent, url ? "prepared" : "error", url ? "" : "Numéro de téléphone invalide pour WhatsApp.");
    if (!url) return NextResponse.json({ error: "Le numéro de téléphone n’est pas valide pour WhatsApp." }, { status: 422 });
    return NextResponse.json({ url, message, event: data.event, confirmationExpiresAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de préparer le message." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  if (!originMatches(request)) return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Modification invalide." }, { status: 400 });
  const data = body as { id?: unknown; status?: unknown; archived?: unknown; reviewed?: unknown };
  if (typeof data.id !== "string" || data.id.length > 64 || (data.status !== undefined && !statuses.includes(data.status as OrderStatus)) || (data.archived !== undefined && typeof data.archived !== "boolean") || (data.reviewed !== undefined && typeof data.reviewed !== "boolean") || (data.status === undefined && data.archived === undefined && data.reviewed === undefined)) return NextResponse.json({ error: "Modification invalide." }, { status: 400 });
  if (data.reviewed === true) {
    markOrderReviewed(data.id);
    const order = getOrderById(data.id);
    return order ? NextResponse.json(order) : NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }
  try {
    const updated = updateOrder(data.id, { status: data.status as OrderStatus | undefined, archived: data.archived as boolean | undefined });
    if (!updated) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    if (data.status === "Delivered" && updated.confirmationToken) {
      const templates = getOrderMessageTemplates();
      const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
      const link = `${site.replace(/\/$/, "")}/order-confirmation/${updated.confirmationToken}`;
      const message = renderOrderMessage(templates.delivered, updated, link);
      const url = whatsappLink(updated.phone, message);
      setOrderWhatsAppState(updated.id, "delivered", url ? "prepared" : "error", url ? "" : "Numéro de téléphone invalide pour WhatsApp.");
      const { confirmationToken: _token, ...safeOrder } = updated;
      return NextResponse.json({ ...safeOrder, deliveryWhatsApp: url ? { url, message } : null, whatsappError: url ? "" : "Numéro de téléphone invalide pour WhatsApp." });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mise à jour impossible." }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  if (!originMatches(request)) return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id || id.length > 64) return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
  return deleteOrder(id) ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
}
