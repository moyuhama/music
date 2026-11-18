import type {Track} from '../domain/types';
import {catalogTracks,combineCatalogs} from '../domain/bundled-catalog';
export const libraryCatalogUrl='https://raw.githubusercontent.com/moyuhama/music-library/main/catalog.json';
async function read(url:string,base:string,hosted:boolean):Promise<Track[]|null>{
 try{
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)return null;const data=await response.json();
  return Array.isArray(data.tracks)?catalogTracks(data.tracks,base,hosted):null;
 }catch{return null;}
}
export async function loadBundledLibrary(previous:Track[]=[]):Promise<Track[]|null>{
 const base=new URL(import.meta.env.BASE_URL,location.origin).href;
 const local=['127.0.0.1','localhost'].includes(location.hostname);
 const [online,files]=await Promise.all([
  read(libraryCatalogUrl+'?v='+Math.floor(Date.now()/60000),libraryCatalogUrl,true),
  read(local?'/__afterglow/library?force=1':base+'music/catalog.json',base,false),
 ]);
 // A small published snapshot also allows the initial library to load when the index host is unavailable.
 const snapshot=online?null:await read(base+'library/catalog.json',base,true);
 const hosted=online??(snapshot?combineCatalogs(snapshot,previous.filter(t=>t.origin?.kind==='bundled'&&t.origin.hosted)):null);
 if(!hosted&&!files)return null;
 if(!hosted)return null; // Preserve saved hosted entries during a network failure.
 return combineCatalogs(files??[],hosted);
}
