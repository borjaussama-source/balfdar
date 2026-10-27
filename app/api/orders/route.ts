import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOrder } from "@/lib/products";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.object({idempotencyKey:z.string().uuid(),customerName:z.string().trim().min(2).max(100),phone:z.string().trim().min(6).max(40),city:z.string().trim().min(2).max(100),address:z.string().trim().min(5).max(500),email:z.union([z.literal(""),z.string().trim().email().max(254)]).default(""),notes:z.string().trim().max(1000).default(""),productId:z.string().uuid().optional(),size:z.string().max(40).default(""),quantity:z.number().int().min(1).max(20).optional(),items:z.array(z.object({productId:z.string().uuid(),size:z.string().max(40).default(""),quantity:z.number().int().min(1).max(20)})).min(1).max(50).optional()}).refine(data=>Boolean(data.items?.length||(data.productId&&data.quantity)),{message:"Ajoutez au moins un article."});
export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");if(!origin)return NextResponse.json({error:"Origine non autorisée."},{status:403});try{if(new URL(origin).origin!==new URL(request.url).origin)return NextResponse.json({error:"Origine non autorisée."},{status:403})}catch{return NextResponse.json({error:"Requête invalide."},{status:403})}
  let raw:unknown;try{raw=await request.json()}catch{return NextResponse.json({error:"Requête invalide."},{status:400})}
  const parsed=schema.safeParse(raw);if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Vérifiez les informations du formulaire."},{status:400});
  try{const result=createOrder(parsed.data);return NextResponse.json({ok:true,orderId:result.order.id,duplicate:result.duplicate},{status:result.duplicate?200:201})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Impossible d’enregistrer la commande."},{status:409})}
}
