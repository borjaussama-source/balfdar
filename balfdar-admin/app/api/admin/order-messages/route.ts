import { NextRequest, NextResponse } from "next/server";
import { getOrderMessageTemplates, saveOrderMessageTemplates, type OrderMessageTemplates } from "@/lib/products";
import { isAdmin } from "@/lib/admin-auth";
import { applyCurrentBranding } from "@/lib/order-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const templates = Object.fromEntries(Object.entries(getOrderMessageTemplates()).map(([event, template]) => [event, applyCurrentBranding(template)])) as OrderMessageTemplates;
  return NextResponse.json({ templates }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin) try { if (new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 }); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 403 }); }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const templates = (body as { templates?: unknown })?.templates;
  if (!templates || typeof templates !== "object" || !["new_order", "delivered", "completed"].every(key => typeof (templates as Record<string, unknown>)[key] === "string")) return NextResponse.json({ error: "Modèles de message invalides." }, { status: 400 });
  try { return NextResponse.json({ templates: saveOrderMessageTemplates(templates as OrderMessageTemplates) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Enregistrement impossible." }, { status: 400 }); }
}
