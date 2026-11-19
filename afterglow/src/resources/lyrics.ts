import type {Track,LyricLine} from '../domain/types.ts';
import {parseLrc} from '../domain/lyrics.ts';
export interface ResourceLyrics {lyricText:string;lyrics:LyricLine[]}
export function neteaseSongId(track:Track):string|null {
 if(track.origin?.kind!=='resource')return null;
 try{
  const url=new URL(track.origin.itemUrl);
  if(url.hostname!=='music.163.com'||!['http:','https:'].includes(url.protocol))return null;
  const route=url.hash.startsWith('#/')?new URL(url.hash.slice(1),url.origin):url;
  if(route.pathname!=='/song')return null;
  const id=route.searchParams.get('id');return id&&/^\d{1,20}$/.test(id)?id:null;
 }catch{return null;}
}
export function normalizeNeteaseLyrics(value:unknown):ResourceLyrics|null {
 const data=value as {code?:number;nolyric?:boolean;uncollected?:boolean;lrc?:{lyric?:unknown}};
 if(!data||data.code!==200||data.nolyric||data.uncollected||typeof data.lrc?.lyric!=='string')return null;
 const lyricText=data.lrc.lyric;if(!lyricText.trim()||lyricText.length>256*1024)return null;
 const content=lyricText.replace(/\[[^\]]*\]/g,'').replace(/[\s，,。.!！]/g,'');
 if(/^(纯音乐(请欣赏)?|此歌曲为没有填词的纯音乐.*|instrumental)$/i.test(content))return null;
 const lyrics=parseLrc(lyricText);return lyrics.some(line=>line.text!=='♪')?{lyricText,lyrics}:null;
}
export async function fetchNeteaseLyrics(id:string,signal:AbortSignal,fetcher:typeof fetch=fetch,local=typeof location!=='undefined'&&['127.0.0.1','localhost'].includes(location.hostname)):Promise<ResourceLyrics|null>{
 if(!/^\d{1,20}$/.test(id))return null;
 const url='https://music.163.com/api/song/lyric?'+new URLSearchParams({id,lv:'-1',kv:'-1',tv:'-1'});
 try{
  signal.throwIfAborted();
  const response=await fetcher(local?'/__afterglow/resource':url,local?{
   method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',signal,
   body:JSON.stringify({url,method:'GET',headers:{Referer:'https://music.163.com/'}}),
  }:{credentials:'omit',referrerPolicy:'no-referrer',signal});
  if(!response.ok)return null;
  const body=await response.text();signal.throwIfAborted();
  if(body.length>256*1024)return null;
  return normalizeNeteaseLyrics(JSON.parse(body));
 }catch(error){if(signal.aborted)throw error;return null;}
}
const cache=new Map<string,{value:ResourceLyrics|null;expires:number}>();
export async function loadResourceLyrics(track:Track,signal:AbortSignal):Promise<ResourceLyrics|null>{
 const id=neteaseSongId(track);if(!id)return null;
 const saved=cache.get(id);if(saved&&saved.expires>Date.now())return saved.value;
 const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),10000);
 try{
  const result=await fetchNeteaseLyrics(id,AbortSignal.any([signal,timeout.signal]));
  signal.throwIfAborted();
  cache.set(id,{value:result,expires:Date.now()+(result?30*60000:60000)});
  if(cache.size>100)cache.delete(cache.keys().next().value!);
  return result;
 }catch(error){if(signal.aborted)throw error;return null;}finally{clearTimeout(timer);}
}
