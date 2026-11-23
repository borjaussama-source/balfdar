import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { deleteMessage, updateMessageRead } from "@/lib/products";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function PATCH(request:NextRequest,{params}:Context){if(!(await isAdmin()))return NextResponse.json({error:"Accès refusé."},{status:401});let data:unknown;try{data=await request.json()}catch{return NextResponse.json({error:"Requête invalide."},{status:400})}if(!data||typeof data!=="object"||typeof (data as {read?:unknown}).read!=="boolean")return NextResponse.json({error:"État invalide."},{status:400});const {id}=await params;if(!updateMessageRead(id,(data as {read:boolean}).read))return NextResponse.json({error:"Message introuvable."},{status:404});return NextResponse.json({ok:true})}
export async function DELETE(_request:NextRequest,{params}:Context){if(!(await isAdmin()))return NextResponse.json({error:"Accès refusé."},{status:401});const {id}=await params;if(!deleteMessage(id))return NextResponse.json({error:"Message introuvable."},{status:404});return new NextResponse(null,{status:204})}
