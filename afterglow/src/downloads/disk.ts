import type {DownloadAsset} from './files';
import {audioExtension,sidecars} from './files';
const base='/__afterglow/downloads';
export const localDownloads=()=>['127.0.0.1','localhost'].includes(location.hostname);
async function request(path:string,body:unknown,signal?:AbortSignal,method='POST') {
  const response=await fetch(base+path,{method,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal,credentials:'omit'});
  const value=await response.json().catch(()=>({error:'本地下载服务未就绪，请重新启动播放器'}));
  if(!response.ok)throw new Error(value.error||'本地下载任务失败');return value;
}
export function createDiskDownload(name:string,batch:boolean,signal:AbortSignal):Promise<{id:string}>{return request('',{name,batch},signal);}
export async function addDiskItem(id:string,index:number,title:string,asset:DownloadAsset,signal:AbortSignal) {
  if(asset.bundledPath)return request('/'+id+'/items',{index,title,bundledPath:asset.bundledPath,subtitles:sidecars(asset)},signal);
  let file=asset.file,url=new URL(asset.url,location.href),headers=asset.headers||{};
  if(url.origin===location.origin&&url.pathname==='/__afterglow/audio'){
    if(url.searchParams.get('type')==='hls')throw new Error('HLS 播放流暂不能保存为单个音频');
    headers={...JSON.parse(url.searchParams.get('headers')||'{}'),...headers};url=new URL(url.searchParams.get('url')||'');
  }
  if(Object.entries(headers).some(([key,value])=>key.toLowerCase()==='x-media-type'&&value==='hls'))throw new Error('HLS 播放流暂不能保存为单个音频');
  const subtitles=sidecars(asset),meta={index,title,fileName:asset.fileName,subtitles};
  if(!file&&(url.protocol==='blob:'||url.origin===location.origin)){
    const response=await fetch(url,{signal});if(!response.ok)throw new Error('无法读取本地音频');file=await response.blob();
  }
  if(file){
    const name=asset.fileName||'audio.'+audioExtension(asset.url,file.type);
    const {token}=await request('/'+id+'/items',{...meta,local:true,fileName:name,mime:file.type},signal);
    const response=await fetch(base+'/'+id+'/upload/'+token,{method:'PUT',body:file,signal,credentials:'omit'});
    const value=await response.json();if(!response.ok)throw new Error(value.error||'无法保存本地音频');return value;
  }
  return request('/'+id+'/items',{...meta,url:url.href,headers},signal);
}
export function finishDiskDownload(id:string,failures:string[],signal:AbortSignal){return request('/'+id+'/finish',{failures},signal);}
export async function diskStatus(id:string):Promise<{bytes:number}>{const response=await fetch(base+'/'+id,{credentials:'omit'});if(!response.ok)throw new Error('下载任务已结束');return response.json();}
export function removeDiskDownload(id:string){return request('/'+id,undefined,undefined,'DELETE');}
export const diskDownloadHref=(id:string)=>base+'/'+id+'/file';
export function saveDiskDownload(id:string){const link=document.createElement('a');link.href=diskDownloadHref(id);link.download='';document.body.append(link);link.click();link.remove();}
