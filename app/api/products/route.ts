import { NextResponse } from "next/server";
import { listProducts } from "@/lib/products";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json((await listProducts()).filter((product) => product.published)); }
  catch { return NextResponse.json({ error: "Impossible de charger les produits." }, { status: 500 }); }
}
