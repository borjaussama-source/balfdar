"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme="light"|"dark"|"system";
const options:{id:Theme;label:string;Icon:typeof Sun}[]=[{id:"light",label:"Clair",Icon:Sun},{id:"dark",label:"Sombre",Icon:Moon},{id:"system",label:"Système",Icon:Monitor}];
function readTheme():Theme{try{const value=localStorage.getItem("akker-theme");return value==="light"||value==="dark"||value==="system"?value:"system"}catch{return "system"}}
function applyTheme(theme:Theme,persist=false){const dark=theme==="dark"||(theme==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);const root=document.documentElement;root.dataset.theme=dark?"dark":"light";root.dataset.themePreference=theme;root.style.colorScheme=dark?"dark":"light";if(persist){try{localStorage.setItem("akker-theme",theme)}catch{}}}
export default function ThemeSelector(){
 const [theme,setTheme]=useState<Theme>("system");const [open,setOpen]=useState(false);
 useEffect(()=>{const saved=readTheme();setTheme(saved);applyTheme(saved);const media=window.matchMedia("(prefers-color-scheme: dark)");const onSystemChange=()=>{if(readTheme()==="system")applyTheme("system")};if(media.addEventListener)media.addEventListener("change",onSystemChange);else media.addListener(onSystemChange);const onStorage=(event:StorageEvent)=>{if(event.key==="akker-theme"){const next=readTheme();setTheme(next);applyTheme(next)}};window.addEventListener("storage",onStorage);return()=>{if(media.removeEventListener)media.removeEventListener("change",onSystemChange);else media.removeListener(onSystemChange);window.removeEventListener("storage",onStorage)}},[]);
 function choose(next:Theme){setTheme(next);applyTheme(next,true);setOpen(false)}
 const Current=options.find(option=>option.id===theme)?.Icon??Monitor;const currentLabel=options.find(option=>option.id===theme)?.label??"Système";
 return <div className="theme-control"><button className="theme-trigger" type="button" aria-label={`Thème : ${currentLabel}`} aria-expanded={open} aria-haspopup="true" title="Choisir le thème" onClick={()=>setOpen(value=>!value)}><Current size={17}/></button>{open&&<div className="theme-menu" role="group" aria-label="Choisir un thème">{options.map(({id,label,Icon})=><button key={id} type="button" className={theme===id?"theme-option selected":"theme-option"} aria-pressed={theme===id} onClick={()=>choose(id)}><Icon size={15}/><span>{label}</span>{theme===id&&<span className="theme-check">✓</span>}</button>)}</div>}</div>
}
