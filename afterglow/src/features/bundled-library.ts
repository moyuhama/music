import type {Track} from '../domain/types';
import {parseLrc} from '../domain/lyrics';
export async function loadBundledLibrary():Promise<Track[]|null>{
 try{
  const local=['127.0.0.1','localhost'].includes(location.hostname);
  const response=await fetch(local?'/__afterglow/library?force=1':import.meta.env.BASE_URL+'music/catalog.json',{cache:'no-store'});
  if(!response.ok)return null;const data=await response.json();if(!Array.isArray(data.tracks))return null;
  return data.tracks.map((row:any)=>({id:row.id,title:row.title,artist:row.artist,album:row.album,duration:row.duration,cover:row.cover?new URL(import.meta.env.BASE_URL+row.cover,location.origin).href:undefined,
    source:{kind:'remote',url:new URL(import.meta.env.BASE_URL+row.url,location.origin).href},origin:{kind:'bundled',path:row.path},addedAt:0,favorite:false,persist:true,lyricText:row.lyricText,lyrics:row.lyricText?parseLrc(row.lyricText):undefined,subtitles:row.subtitles}));
 }catch{return null;}
}
