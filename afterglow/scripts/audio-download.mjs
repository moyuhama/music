import {publicTarget,openPublic,readPublic,localRequest} from './public-network.mjs';
export const audioTarget=value=>publicTarget(value).href;
export function mediaRoute(value,headers={},type='') {
  const query=new URLSearchParams({url:audioTarget(value)});
  if(Object.keys(headers).length)query.set('headers',JSON.stringify(headers));
  if(type)query.set('type',type);
  return '/__afterglow/audio?'+query;
}
export function rewriteHls(text,base,headers={}) {
  return text.split(/\r?\n/).map(line=>{
    if(!line.trim())return line;
    if(line.startsWith('#'))return line.replace(/URI="([^"]+)"/g,(_all,uri)=>'URI="'+mediaRoute(new URL(uri,base),headers)+'"');
    return mediaRoute(new URL(line.trim(),base),headers);
  }).join('\n');
}
let pending=0;
export async function handleAudioDownload(req,res) {
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname!=='/__afterglow/audio')return false;
  const fail=(code,text)=>{if(res.destroyed)return;res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(text);};
  if(!localRequest(req)){fail(403,'仅支持本机播放器');return true;}
  if(!['GET','HEAD'].includes(req.method)){fail(405,'仅支持读取媒体');return true;}
  let target,headers;
  try{target=audioTarget(url.searchParams.get('url'));headers=JSON.parse(url.searchParams.get('headers')||'{}');if(!headers||typeof headers!=='object'||JSON.stringify(headers).length>16384)throw new Error();}catch{fail(400,'音频地址或请求头无效');return true;}
  if(pending>=12){fail(429,'媒体请求过多');return true;}
  pending++;
  const controller=new AbortController();let timer=setTimeout(()=>controller.abort(),12000);
  const close=()=>controller.abort();res.on('close',close);
  try{
    if(req.headers.range){if(!/^bytes=\d*-\d*$/.test(req.headers.range))throw new Error('Range 参数无效');headers.Range=req.headers.range;}
    const upstream=await openPublic(target,{method:req.method,headers,signal:controller.signal});
    clearTimeout(timer);
    if(upstream.status<200||upstream.status>=300){upstream.stream.destroy();fail(upstream.status,'音源返回 HTTP '+upstream.status);return true;}
    const mime=String(upstream.headers['content-type']||'application/octet-stream');
    const hls=url.searchParams.get('type')==='hls'||/mpegurl/i.test(mime)||/\.m3u8(?:$|\?)/i.test(upstream.url);
    if(hls){
      timer=setTimeout(()=>controller.abort(),12000);const chunks=[];let size=0;
      for await(const chunk of upstream.stream){size+=chunk.length;if(size>2*1024*1024)throw new Error('播放清单过大');chunks.push(chunk);}
      const text=Buffer.concat(chunks).toString('utf8');if(!text.trimStart().startsWith('#EXTM3U'))throw new Error('音源没有返回有效 HLS 清单');
      const body=rewriteHls(text,upstream.url,headers);res.writeHead(200,{'Content-Type':'application/vnd.apple.mpegurl','Cache-Control':'no-store'});res.end(body);return true;
    }
    if(/text\/html|application\/json/i.test(mime)){upstream.stream.destroy();throw new Error('音源返回了网页或错误信息');}
    const download=url.searchParams.get('mode')==='download',limit=download?100*1024*1024:Infinity;
    if(download)timer=setTimeout(()=>controller.abort(),90000);
    const outgoing={'Content-Type':mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    for(const name of ['accept-ranges','content-range'])if(upstream.headers[name])outgoing[name]=upstream.headers[name];
    if(upstream.headers['content-length']&&!upstream.headers['content-encoding'])outgoing['content-length']=upstream.headers['content-length'];
    if(Number(upstream.headers['content-length'])>limit){upstream.stream.destroy();throw new Error('文件超过100MB');}
    res.writeHead(upstream.status,outgoing);
    if(req.method==='HEAD'){upstream.stream.destroy();res.end();return true;}
    let size=0;
    for await(const chunk of upstream.stream){
      size+=chunk.length;if(size>limit)throw new Error('文件超过100MB');
      if(!res.write(chunk))await new Promise((resolve,reject)=>{
        const cleanup=()=>{res.off('drain',drain);res.off('close',closed);};const drain=()=>{cleanup();resolve();};const closed=()=>{cleanup();reject(new Error('已取消'));};res.once('drain',drain);res.once('close',closed);
      });
    }
    res.end();
  }catch(error){if(res.headersSent)res.destroy();else fail(502,error.message||'媒体请求失败');}
  finally{pending--;clearTimeout(timer);res.off('close',close);controller.abort();}
  return true;
}
