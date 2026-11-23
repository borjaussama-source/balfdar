import { NextRequest, NextResponse } from "next/server";
import { confirmOrderDelivery, getOrderForConfirmation } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function trustedStoreOrigin(origin: string, request: NextRequest) {
  try {
    const actual = new URL(origin).origin;
    const allowed = [new URL(request.url).origin, process.env.BALFDAR_STORE_ORIGIN].filter(Boolean).map(value => {
      try { return new URL(value!).origin; } catch { return ""; }
    });
    return allowed.includes(actual);
  } catch { return false; }
}

type Context = { params: Promise<{ token: string }> };
export async function GET(_request: NextRequest, context: Context) {
  const { token } = await context.params;
  const order = getOrderForConfirmation(token);
  return order ? NextResponse.json({ valid: true, orderId: order.orderId }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ valid: false }, { status: 410, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: Context) {
  const origin = request.headers.get("origin");
  if (origin && !trustedStoreOrigin(origin, request)) return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  const { token } = await context.params;
  const result = confirmOrderDelivery(token);
  if (!result.ok) return NextResponse.json({ error: result.reason === "used" ? "Cette confirmation a déjà été utilisée." : "Ce lien est invalide ou a expiré." }, { status: result.reason === "expired" ? 410 : 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
