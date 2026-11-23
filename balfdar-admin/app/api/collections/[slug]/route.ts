import { NextResponse } from "next/server";
import { getCollectionWithProducts } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    const collection = getCollectionWithProducts(slug);
    return collection
      ? NextResponse.json(collection, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "Collection introuvable." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Impossible de charger cette collection." }, { status: 500 });
  }
}
