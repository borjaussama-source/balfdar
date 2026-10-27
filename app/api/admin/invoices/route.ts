import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { listInvoices } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const params = request.nextUrl.searchParams;
  const parsePage = (value: string | null, fallback: number) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  try {
    const result = listInvoices({
      page: parsePage(params.get("page"), 1),
      pageSize: Math.min(100, parsePage(params.get("pageSize"), 20)),
      query: (params.get("q") ?? "").slice(0, 120),
      status: (params.get("status") ?? "").slice(0, 20),
      orderStatus: (params.get("orderStatus") ?? "").slice(0, 20),
      from: (params.get("from") ?? "").slice(0, 10),
      to: (params.get("to") ?? "").slice(0, 10),
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Impossible de charger les factures." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
