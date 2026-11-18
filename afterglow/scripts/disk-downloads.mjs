import {bundledFile} from './bundled-library.mjs';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {ZipFile} from 'yazl';
import {openPublic,publicTarget,localRequest} from './public-network.mjs';
import {safeName,audioExtension} from '../src/downloads/format.mjs';
const defaultRoot=fileURLToPath(new URL('../.runtime/downloads/',import.meta.url));
export class DiskDownloads {
 constructor({root=defaultRoot,opener=openPublic,ttl=3600000}={}){this.root=root;this.opener=opener;this.ttl=ttl;this.jobs=new Map();}
 async create(name,batch){
  if([...this.jobs.values()].filter(job=>!job.ready).length>=4)throw new Error('下载任务过多，请先完成或取消已有任务');
  await fsp.mkdir(this.root,{recursive:true,mode:0o700});
  const id=randomUUID(),dir=path.join(this.root,id);await fsp.mkdir(dir,{mode:0o700});
  await fsp.writeFile(path.join(dir,'owner.json'),JSON.stringify({pid:process.pid}),{mode:0o600});
  const job={id,dir,name:safeName(name),batch:!!batch,entries:[],indices:new Set(),local:new Map(),bytes:0,currentBytes:0,last:Date.now(),busy:false,transfers:0,ready:null};
  this.jobs.set(id,job);return id;
 }
 get(id){const job=this.jobs.get(id);if(!job)throw new Error('下载任务不存在或已过期，请重新下载');job.last=Date.now();return job;}
 async run(job,operation){
  if(job.busy||job.ready)throw new Error('下载任务正在处理或已完成');
  job.busy=true;job.controller=new AbortController();
  try{return await operation(job.controller.signal);}finally{job.busy=false;job.currentBytes=0;job.controller?.abort();job.controller=null;job.last=Date.now();}
 }
 metadata(job,input){
  if(!Number.isSafeInteger(input.index)||input.index<0||job.indices.has(input.index))throw new Error('下载条目顺序无效或重复');
  const extras=(input.subtitles||[]);if(!Array.isArray(extras)||extras.length>20||extras.some(item=>!item||typeof item.text!=='string'||!['lrc','srt','vtt','txt'].includes(item.format)))throw new Error('字幕格式无效');
  const base=(job.batch?String(input.index+1).padStart(3,'0')+' ':'')+safeName(input.title);
  return {index:input.index,base,extras};
 }
 async spool(job,stream,file,signal){
  let bytes=0;let idle;
  const touch=()=>{clearTimeout(idle);idle=setTimeout(()=>job.controller?.abort(),30000);};touch();
  try{
   await pipeline(stream,new Transform({transform(chunk,_encoding,done){bytes+=chunk.length;job.currentBytes=bytes;touch();done(null,chunk);}}),fs.createWriteStream(file,{flags:'wx',mode:0o600}),{signal});
   if(!bytes)throw new Error('音频文件为空');return bytes;
  }finally{clearTimeout(idle);}
 }
 async commit(job,meta,file,bytes,extension){
  job.controller?.signal.throwIfAborted();if(!this.jobs.has(job.id))throw new Error("下载已取消");
  const rows=[{file,name:meta.base+'.'+extension,bytes}];const created=[];const counts=new Map();
  try{
   for(const extra of meta.extras){const count=(counts.get(extra.format)||0)+1;counts.set(extra.format,count);const dest=path.join(job.dir,randomUUID()+'.text');await fsp.writeFile(dest,extra.text,{mode:0o600});created.push(dest);rows.push({file:dest,name:meta.base+(count>1?'.'+count:'')+'.'+extra.format,bytes:Buffer.byteLength(extra.text)});}
   job.controller?.signal.throwIfAborted();
   job.indices.add(meta.index);job.entries.push(...rows);job.bytes+=rows.reduce((sum,row)=>sum+row.bytes,0);return {bytes};
  }catch(error){await Promise.all(created.map(dest=>fsp.rm(dest,{force:true})));throw error;}
 }
 async addRemote(id,input){
  const job=this.get(id),meta=this.metadata(job,input);if(!input.bundledPath)publicTarget(input.url);
  return this.run(job,async signal=>{
   const file=path.join(job.dir,randomUUID()+'.audio');let upstream;
   try{
    if(input.bundledPath){const file=await bundledFile(input.bundledPath);upstream={status:200,url:'https://bundled.invalid/'+encodeURIComponent(path.basename(file)),headers:{'content-type':'application/octet-stream'},stream:fs.createReadStream(file)};}
    else upstream=await this.opener(input.url,{headers:input.headers,signal});
    if(upstream.status<200||upstream.status>=300)throw new Error('下载失败（HTTP '+upstream.status+'）');
    const mime=String(upstream.headers['content-type']||'application/octet-stream');
    if(/text\/|json|mpegurl/i.test(mime)||/\.m3u8(?:$|\?)/i.test(upstream.url||input.url)||upstream.headers['icy-name']||upstream.headers['icy-metaint'])throw new Error('此来源是网页、直播流或播放清单，不能保存为单个音频');
    const bytes=await this.spool(job,upstream.stream,file,signal);
    return await this.commit(job,meta,file,bytes,audioExtension(input.fileName||input.bundledPath||input.url,mime));
   }catch(error){upstream?.stream.destroy();await fsp.rm(file,{force:true});throw error;}
  });
 }
 prepareLocal(id,input){const job=this.get(id);if(job.busy||job.ready)throw new Error('下载任务正在处理或已完成');const token=randomUUID();job.local.set(token,{...this.metadata(job,input),fileName:input.fileName||input.title,mime:input.mime||''});return token;}
 async upload(id,token,stream){
  const job=this.get(id),meta=job.local.get(token);if(!meta)throw new Error('本地文件上传任务不存在');job.local.delete(token);
  return this.run(job,async signal=>{const file=path.join(job.dir,randomUUID()+'.audio');try{const bytes=await this.spool(job,stream,file,signal);return await this.commit(job,meta,file,bytes,audioExtension(meta.fileName,meta.mime));}catch(error){await fsp.rm(file,{force:true});throw error;}});
 }
 async finish(id,failures=[]){
  const job=this.get(id);if(!job.entries.length)throw new Error('没有成功下载的音频');
  if(!Array.isArray(failures)||failures.some(item=>typeof item!=='string'))throw new Error('失败清单无效');
  return this.run(job,async signal=>{
   if(!job.batch&&job.entries.length===1&&!failures.length){job.ready=job.entries[0];return this.status(id);}
   const file=path.join(job.dir,'download.zip');const inputs=new Set();const zip=new ZipFile();zip.on('error',error=>zip.outputStream.destroy(error));
   const writing=pipeline(zip.outputStream,fs.createWriteStream(file,{flags:'wx',mode:0o600}),{signal});
   try{
    for(const entry of job.entries)zip.addReadStreamLazy(entry.name,{compress:false,size:entry.bytes},callback=>{const stream=fs.createReadStream(entry.file);inputs.add(stream);stream.once('close',()=>inputs.delete(stream));callback(null,stream);});
    if(failures.length)zip.addBuffer(Buffer.from(failures.join('\n')),'下载失败清单.txt',{compress:false});
    zip.end();await writing;
    job.ready={file,name:job.name+'.zip',bytes:(await fsp.stat(file)).size};
    await Promise.all(job.entries.map(entry=>fsp.rm(entry.file,{force:true})));
    return this.status(id);
   }catch(error){for(const stream of inputs)stream.destroy();zip.outputStream.destroy();await writing.catch(()=>{});await fsp.rm(file,{force:true});throw error;}
  });
 }
 status(id){const job=this.get(id);return {bytes:job.bytes+job.currentBytes,ready:!!job.ready};}
 async remove(id){const job=this.jobs.get(id);if(!job)return;this.jobs.delete(id);job.controller?.abort();await fsp.rm(job.dir,{recursive:true,force:true});}
 async sweep(){
  for(const [id,job]of this.jobs)if(!job.busy&&!job.transfers&&Date.now()-job.last>this.ttl)await this.remove(id);
  // Abandoned directories from an earlier service process are also reclaimed.
  for(const entry of await fsp.readdir(this.root,{withFileTypes:true}).catch(()=>[])){
   if(!entry.isDirectory()||!/^[-a-f\d]{36}$/.test(entry.name)||this.jobs.has(entry.name))continue;
   const dir=path.join(this.root,entry.name),stat=await fsp.stat(dir);if(Date.now()-stat.mtimeMs<this.ttl)continue;
   try{const owner=JSON.parse(await fsp.readFile(path.join(dir,'owner.json'),'utf8'));process.kill(owner.pid,0);continue;}catch{}
   await fsp.rm(dir,{recursive:true,force:true});
  }
 }
}
async function jsonBody(req){const parts=[];let bytes=0;for await(const part of req){bytes+=part.length;if(bytes>4*1024*1024)throw new Error('下载任务信息过大');parts.push(part);}return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');}
export function createDiskDownloadHandler(manager=new DiskDownloads()) {
 const interval=setInterval(()=>{void manager.sweep().catch(()=>{});},60000);interval.unref();
 const handler=async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');if(!url.pathname.startsWith('/__afterglow/downloads'))return false;
  const answer=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  if(!localRequest(req)){answer(403,{error:'仅允许本机播放器使用下载服务'});return true;}
  let jobId;const close=()=>{if(jobId)manager.jobs.get(jobId)?.controller?.abort();};
  try{
   const parts=url.pathname.split('/').slice(3);jobId=parts[0];const action=parts[1];
   if(!jobId&&req.method==='POST'){const input=await jsonBody(req);answer(200,{id:await manager.create(input.name,input.batch)});return true;}
   if(!jobId){answer(405,{error:'请求方式不支持'});return true;}
   if(req.method==='DELETE'){await manager.remove(jobId);answer(200,{removed:true});return true;}
   if(req.method==='GET'&&!action){answer(200,manager.status(jobId));return true;}
   if(req.method==='GET'&&action==='file'){
    const job=manager.get(jobId);if(!job.ready)throw new Error('下载文件还未准备好');
    const {file,name,bytes}=job.ready;let start=0,end=bytes-1,status=200;
    if(req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match){res.writeHead(416);res.end();return true;}start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));if(start>end||start>=bytes){res.writeHead(416);res.end();return true;}status=206;}
    const headers={'Content-Type':name.endsWith('.zip')?'application/zip':'application/octet-stream','Content-Disposition':`attachment; filename="download${path.extname(name)}"; filename*=UTF-8''${encodeURIComponent(name).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16))}`,'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${bytes}`;
    job.transfers++;res.writeHead(status,headers);try{await pipeline(fs.createReadStream(file,{start,end}),res);}finally{job.transfers--;job.last=Date.now();}return true;
   }
   res.on('close',close);
   if(req.method==='POST'&&action==='items'){const input=await jsonBody(req);if(input.local){const token=manager.prepareLocal(jobId,input);answer(200,{token});}else answer(200,await manager.addRemote(jobId,input));return true;}
   if(req.method==='PUT'&&action==='upload'){answer(200,await manager.upload(jobId,parts[2],req));return true;}
   if(req.method==='POST'&&action==='finish'){const input=await jsonBody(req);answer(200,await manager.finish(jobId,input.failures));return true;}
   answer(405,{error:'请求方式不支持'});
  }catch(error){if(!res.headersSent&&!res.destroyed)answer(400,{error:error.code==='ENOSPC'?'磁盘空间不足，请释放空间后重试':error.name==='AbortError'?'下载已取消或连接超时':error.message||'下载任务失败'});else if(!res.destroyed)res.destroy();}
  finally{res.off('close',close);}return true;
 };
 handler.dispose=async()=>{clearInterval(interval);await Promise.all([...manager.jobs.keys()].map(id=>manager.remove(id)));};return handler;
}
export const handleDiskDownloads=createDiskDownloadHandler();
