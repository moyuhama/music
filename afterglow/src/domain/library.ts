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
 const result=tracks.filter(t=>t.origin?.kind!=='bundled'||present.has(t.id)).map(track=>{const fresh=present.get(track.id);return fresh?{...fresh,...track,source:fresh.source,duration:fresh.duration,origin:fresh.origin,lyricText:fresh.lyricText,lyrics:fresh.lyrics,subtitles:fresh.subtitles,cover:track.cover||fresh.cover}:track;});
 const ids=new Set(result.map(t=>t.id));for(const track of catalog)if(!ids.has(track.id)&&!known.includes(track.id))result.push(track);
 return{tracks:result,catalogIds:[...new Set([...known,...catalog.map(t=>t.id)])]};
}
