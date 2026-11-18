import type {Track,Playlist} from './types.ts';
export function legacyPlaybackEntry(track:Track){
 if(track.origin||track.source.kind!=='remote')return false;
 try{const url=new URL(track.source.url);return ['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/__afterglow/audio';}catch{return false;}
}
export function migratePlaybackHistory(tracks:Track[],playlists:Playlist[]){
 const pinned=new Set(playlists.flatMap(p=>p.trackIds));
 return tracks.filter(track=>!legacyPlaybackEntry(track)||track.favorite||pinned.has(track.id));
}
export function libraryTrack(track:Track){return track.origin?.kind!=='resource'||track.persist;}
export function mergeBundled(tracks:Track[],catalog:Track[],known:string[]){
 const present=new Map(catalog.map(t=>[t.id,t]));
 const result=tracks.filter(t=>t.origin?.kind!=='bundled'||present.has(t.id)).map(track=>{const fresh=present.get(track.id);return fresh?{...fresh,...track,source:fresh.source,duration:fresh.duration,origin:fresh.origin,lyricText:fresh.lyricText,lyrics:fresh.lyrics,subtitles:fresh.subtitles,cover:fresh.cover}:track;});
 const ids=new Set(result.map(t=>t.id));for(const track of catalog)if(!ids.has(track.id)&&!known.includes(track.id))result.push(track);
 return{tracks:result,catalogIds:[...new Set([...known,...catalog.map(t=>t.id)])]};
}
// Old versions stored signed CDN URLs as permanent tracks without source provenance.
// Migrate only an unambiguous catalog match; similarly titled performances may differ.
export function reconcileLegacyCatalog(tracks:Track[],catalog:Track[]){
 const aliases=new Map<string,string>();
 const normalize=(value:string|undefined)=>(value??'').normalize('NFKC').replace(/\s+/g,'');
 const candidates=new Map<string,Track[]>();
 for(const track of catalog){const key=normalize(track.album)+'\n'+normalize(track.title);candidates.set(key,[...(candidates.get(key)??[]),track]);}
 for(const track of tracks){
  if(track.origin||track.source.kind!=='remote')continue;
  let url:URL;try{url=new URL(track.source.url);}catch{continue;}
  if(!url.hostname.endsWith('.xmcdn.com')||!['sign','token','timestamp','buy_key'].some(key=>url.searchParams.has(key)))continue;
  const matches=(candidates.get(normalize(track.album)+'\n'+normalize(track.title))??[]).filter(fresh=>track.duration&&fresh.duration&&Math.abs(track.duration-fresh.duration)<2);
  if(matches.length===1)aliases.set(track.id,matches[0].id);
 }
 if(!aliases.size)return{tracks,aliases};
 const retained=tracks.filter(track=>!aliases.has(track.id));
 for(const targetId of new Set(aliases.values())){
  const originals=tracks.filter(track=>track.id===targetId||aliases.get(track.id)===targetId);
  const fresh=catalog.find(track=>track.id===targetId)!;
  const existing=retained.find(track=>track.id===targetId);
  const merged={...fresh,...existing,source:fresh.source,origin:fresh.origin,cover:fresh.cover,
   favorite:originals.some(track=>track.favorite),lastPlayed:Math.max(...originals.map(track=>track.lastPlayed??0)),persist:true};
  const index=retained.findIndex(track=>track.id===targetId);if(index>=0)retained[index]=merged;else retained.push(merged);
 }
 return{tracks:retained,aliases};
}
export function remapTrackIds(ids:string[],aliases:Map<string,string>){return [...new Set(ids.map(id=>aliases.get(id)??id))];}
