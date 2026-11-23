import { NextResponse } from "next/server";
import { listCollections } from "@/lib/products";
export const dynamic="force-dynamic";
export async function GET(){try{return NextResponse.json(listCollections(false).map(({productIds,...collection})=>collection))}catch{return NextResponse.json({error:"Impossible de charger les collections."},{status:500})}}
