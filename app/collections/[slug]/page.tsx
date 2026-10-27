import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight,ArrowUpRight } from "lucide-react";
import { getCollectionWithProducts } from "@/lib/products";
import ThemeSelector from "@/app/theme-selector";
import LanguageSelector from "@/app/language-selector";
import CollectionProductGrid from "./product-grid";

type Context={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Context):Promise<Metadata>{const {slug}=await params;const collection=getCollectionWithProducts(slug);if(!collection)return {title:"Collection introuvable · BALFDAR"};return {title:`${collection.name} · BALFDAR`,description:collection.description||`Découvrez la collection ${collection.name} sélectionnée par BALFDAR à Casablanca.`,openGraph:{title:`${collection.name} · BALFDAR`,description:collection.description||`Découvrez la collection ${collection.name} sélectionnée par BALFDAR à Casablanca.`,images:collection.image?[{url:collection.image,alt:collection.name}]:[]}}}
const money=(n:number)=>new Intl.NumberFormat("fr-MA",{style:"currency",currency:"MAD",maximumFractionDigits:0}).format(n);
export default async function CollectionPage({params}:Context){const {slug}=await params;const collection=getCollectionWithProducts(slug);if(!collection)notFound();return <main>
 <div className="announce">LA SÉLECTION BALFDAR — ÉDITION 01 <span>CASABLANCA · MAROC</span></div>
 <header className="nav collection-page-nav"><a className="wordmark" href="/"><img className="brand-logo" src="/balfdar-logo.png" alt="BALFDAR"/></a><nav className="links"><a href="/#collections">COLLECTIONS</a><a href="/#manifesto">LA MAISON</a><a href="/#contact">CONTACT</a></nav><LanguageSelector/><ThemeSelector/><a className="bag" href="/#collection">PANIER <span className="bag-count">↗</span></a></header>
 <section className="collection-detail"><a className="text-link collection-back" href="/#collections"><ArrowRight size={14}/> TOUTES LES COLLECTIONS</a><p className="section-label">COLLECTION BALFDAR · CASABLANCA</p><div className="collection-detail-heading"><div><h1>{collection.name}</h1><p>{collection.description}</p><small>{collection.productCount} pièce{collection.productCount===1?"":"s"} sélectionnée{collection.productCount===1?"":"s"}</small></div>{collection.image&&<img className="collection-detail-cover" src={collection.image} alt={collection.name}/>}</div>
 {collection.products.length===0?<div className="empty-collection"><p className="section-label">LA SÉLECTION EST EN COURS</p><h2>Cette collection est actuellement vide.</h2><p>Revenez bientôt découvrir les nouvelles pièces.</p><a className="cta dark" href="/#collection">DÉCOUVRIR LA SÉLECTION <ArrowRight size={16}/></a></div>:<CollectionProductGrid products={collection.products}/>}
 </section>
 <footer><div className="footer-top"><a className="wordmark" href="/"><img className="brand-logo" src="/balfdar-logo.png" alt="BALFDAR"/></a><p>Le style sans compromis.</p><a href="https://wa.me/212611923996" target="_blank" rel="noreferrer">WHATSAPP · +212 611-923996 <ArrowUpRight size={15}/></a></div><div className="footer-bottom"><span>© BALFDAR 2026</span><div><a href="/#contact">LIVRAISON & RETOURS</a><a href="/#contact">CONFIDENTIALITÉ</a><a href="/#contact">CONDITIONS</a></div><span>CASABLANCA, MAROC</span></div></footer>
 </main>}
