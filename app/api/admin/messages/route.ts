import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { listMessages } from "@/lib/products";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){if(!(await isAdmin()))return NextResponse.json({error:"Accès refusé."},{status:401});return NextResponse.json(listMessages())}
