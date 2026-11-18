import type {Track} from './types.ts';
import {parseLrc} from './lyrics.ts';
export interface CatalogRow {
 id:string;title:string;artist:string;album?:string;duration?:number;cover?:string;
 path:string;url:string;lyricText?:string;subtitles?:Track['subtitles'];
}
export function catalogTracks(rows:CatalogRow[],baseUrl:string,hosted=false):Track[]{
 const safeUrl=(value:string)=>{const url=new URL(value,baseUrl);if(!['http:','https:'].includes(url.protocol))throw new Error('曲库链接无效');return url.href;};
 return rows.map(row=>({id:row.id,title:row.title,artist:row.artist,album:row.album,duration:row.duration,cover:row.cover?safeUrl(row.cover):undefined,
  source:{kind:'remote',url:safeUrl(row.url)},origin:{kind:'bundled',path:row.path,hosted},addedAt:0,favorite:false,persist:true,
  lyricText:row.lyricText,lyrics:row.lyricText?parseLrc(row.lyricText):undefined,subtitles:row.subtitles}));
}
export function combineCatalogs(local:Track[],hosted:Track[]){return [...new Map([...local,...hosted].map(track=>[track.id,track])).values()];}
