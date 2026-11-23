import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin, hasPermission } from "@/lib/admin-auth";
import { deleteStaffAccount, getStaffAccountById, listStaffAccounts, STAFF_PERMISSIONS, updateStaffAccount, type StaffPermission } from "@/lib/products";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const originMatches=(request:NextRequest)=>{const origin=request.headers.get("origin");if(!origin)return true;try{return new URL(origin).origin===new URL(request.url).origin}catch{return false}};
function canManageTarget(actor:NonNullable<Awaited<ReturnType<typeof getCurrentAdmin>>>,target:{role:string;managerId:string}){
  if(actor.role==="super_admin")return true;
  return actor.role==="admin"&&actor.permissions.includes("employees.manage")&&target.role==="employee"&&target.managerId===actor.id;
}

export async function PATCH(request:NextRequest,{params}:Context){
  const actor=await getCurrentAdmin();if(!actor)return NextResponse.json({error:"Accès refusé."},{status:401});
  if(!originMatches(request))return NextResponse.json({error:"Origine non autorisée."},{status:403});
  const {id}=await params;const current=getStaffAccountById(id);
  if(!current||!canManageTarget(actor,current))return NextResponse.json({error:"Compte introuvable ou accès refusé."},{status:404});
  let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Requête invalide."},{status:400})}
  if(!body||typeof body!=="object")return NextResponse.json({error:"Modification invalide."},{status:400});
  const data=body as Record<string,unknown>;
  if("role" in data)return NextResponse.json({error:"Le rôle d’un compte existant ne peut pas être modifié."},{status:403});
  if(data.username!==undefined&&typeof data.username!=="string"||data.email!==undefined&&typeof data.email!=="string"||data.active!==undefined&&typeof data.active!=="boolean"||data.password!==undefined&&typeof data.password!=="string"||data.managerId!==undefined&&typeof data.managerId!=="string")return NextResponse.json({error:"Modification invalide."},{status:400});
  let permissions:StaffPermission[]|undefined;
  if(data.permissions!==undefined){
    if(!Array.isArray(data.permissions)||data.permissions.length>STAFF_PERMISSIONS.length||data.permissions.some(value=>typeof value!=="string"||!STAFF_PERMISSIONS.includes(value as StaffPermission)))return NextResponse.json({error:"Permissions invalides."},{status:400});
    permissions=Array.from(new Set(data.permissions as StaffPermission[]));
    if(current.role==="employee"&&permissions.includes("employees.manage"))return NextResponse.json({error:"Les employés ne peuvent pas gérer d’autres comptes."},{status:400});
    if(actor.role==="admin"&&permissions.some(permission=>permission==="employees.manage"||!actor.permissions.includes(permission)))return NextResponse.json({error:"Vous ne pouvez attribuer que vos propres permissions, sans gestion de comptes."},{status:403});
  }
  if(actor.role!=="super_admin"&&data.managerId!==undefined)return NextResponse.json({error:"Vous ne pouvez pas déplacer un employé hors de votre périmètre."},{status:403});
  try{
    const account=updateStaffAccount(id,{username:data.username as string|undefined,email:data.email as string|undefined,active:data.active as boolean|undefined,permissions,newPassword:data.password as string|undefined,managerId:data.managerId as string|undefined});
    return account?NextResponse.json({account},{headers:{"Cache-Control":"no-store"}}):NextResponse.json({error:"Compte introuvable."},{status:404});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Modification impossible."},{status:400})}
}

export async function DELETE(request:NextRequest,{params}:Context){
  const actor=await getCurrentAdmin();if(!actor||!(await hasPermission("employees.manage")))return NextResponse.json({error:"Accès refusé."},{status:401});
  if(!originMatches(request))return NextResponse.json({error:"Origine non autorisée."},{status:403});
  const {id}=await params;const target=getStaffAccountById(id);
  if(!target||!canManageTarget(actor,target))return NextResponse.json({error:"Compte introuvable ou accès refusé."},{status:404});
  if(id===actor.id)return NextResponse.json({error:"Vous ne pouvez pas supprimer votre propre compte."},{status:400});
  try{return deleteStaffAccount(id)?new NextResponse(null,{status:204}):NextResponse.json({error:"Compte introuvable."},{status:404})}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Suppression impossible."},{status:409})}
}
