import {publicResourceUrl} from './policy.ts';
export function resourceMediaUrl(url:string,headers:Record<string,string>={},mode='play') {
  const href=publicResourceUrl(url);
  const mediaType=Object.entries(headers).find(([key])=>key.toLowerCase()==='x-media-type')?.[1];
  const clean=Object.fromEntries(Object.entries(headers).filter(([key])=>key.toLowerCase()!=='x-media-type'));
  if(Object.keys(clean).some(key=>/^(cookie|authorization)$/i.test(key)))throw new Error('此音源需要登录会话，当前网页版暂不支持');
  if(['127.0.0.1','localhost'].includes(location.hostname)){
    const query=new URLSearchParams({url:href,mode});
    if(Object.keys(clean).length)query.set('headers',JSON.stringify(clean));
    if(mediaType==='hls'||/\.m3u8(?:$|\?)/i.test(href))query.set('type','hls');
    return new URL('/__afterglow/audio?'+query,location.origin).href;
  }
  if(Object.keys(clean).some(key=>key.toLowerCase()!=='referer'))throw new Error('此音源需要媒体请求头，请使用本地启动服务');
  return href;
}
