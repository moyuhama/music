import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import {isIP} from 'node:net';
import {createGunzip,createInflate,createBrotliDecompress} from 'node:zlib';
export function publicAddress(address) {
  const family=isIP(address);
  if(family===4){const [a,b,c]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));}
  if(family===6){const first=parseInt(address.split(':')[0],16);return first>=0x2000&&first<=0x3fff&&!/^2002:|^2001:(?:db8|0|2|10|20):/i.test(address);}
  return false;
}
export function publicTarget(value) {
  const url=new URL(value),host=url.hostname.replace(/^\[|\]$/g,'');
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||(!host.includes('.')&&!isIP(host))||(isIP(host)&&!publicAddress(host)))throw new Error('禁止访问本机、私有网络或非公开接口');
  url.hash='';return url;
}
export async function publicLookup(host) {
  if(isIP(host)){if(!publicAddress(host))throw new Error('禁止访问私有网络');return {address:host,family:isIP(host)};}
  const values=await dns.lookup(host,{all:true});
  if(!values.length||values.some(item=>!publicAddress(item.address)))throw new Error('音源域名指向非公开网络，已拒绝访问');
  return values.find(item=>item.family===4)||values[0];
}
export async function openPublic(value,options={},redirects=0) {
  const url=publicTarget(value);options.signal?.throwIfAborted();
  const resolved=await publicLookup(url.hostname.replace(/^\[|\]$/g,''));options.signal?.throwIfAborted();
  const headers={'User-Agent':'Mozilla/5.0','Accept-Encoding':'gzip, deflate, br'};
  for(const [key,val] of Object.entries(options.headers||{})){
    if(/^(host|cookie|authorization|proxy-|connection|transfer-encoding|content-length|upgrade|origin|sec-|x-forwarded)/i.test(key))continue;
    if(typeof val!=='string'||val.length>8192||/[\r\n]/.test(val))throw new Error('音源请求头无效');headers[key]=val;
  }
  const response=await new Promise((resolve,reject)=>{
    const req=(url.protocol==='https:'?https:http).request(url,{method:options.method||'GET',headers,agent:false,signal:options.signal,
      lookup(_host,lookupOptions,callback){callback(null,lookupOptions.all?[resolved]:resolved.address,resolved.family);}},resolve);
    req.on('error',reject);req.end(options.body);
  });
  if([301,302,303,307,308].includes(response.statusCode)&&response.headers.location){
    response.destroy();if(redirects>=3)throw new Error('音源重定向次数过多');
    const next=new URL(response.headers.location,url);publicTarget(next);
    return openPublic(next,{...options,...(response.statusCode===303||([301,302].includes(response.statusCode)&&options.method==='POST')?{method:'GET',body:undefined}:{})},redirects+1);
  }
  let stream=response;
  const encoding=response.headers['content-encoding'];
  const decoder=encoding==='gzip'?createGunzip():encoding==='deflate'?createInflate():encoding==='br'?createBrotliDecompress():null;
  if(decoder){response.on('error',error=>decoder.destroy(error));decoder.on('close',()=>response.destroy());stream=response.pipe(decoder);}
  return {stream,status:response.statusCode||502,url:url.href,headers:response.headers};
}
export async function readPublic(value,options={},limit=4*1024*1024) {
  const result=await openPublic(value,options);
  if(options.readBody===false){result.stream.destroy();return {...result,body:Buffer.alloc(0)};}
  const chunks=[];let size=0;
  try{for await(const part of result.stream){size+=part.length;if(size>limit)throw new Error('音源响应超过大小限制');chunks.push(part);}}
  finally{result.stream.destroy();}
  return {...result,body:Buffer.concat(chunks)};
}
export function localRequest(req) {
  const host=req.headers.host||'',site=req.headers['sec-fetch-site'];
  return /^(127\.0\.0\.1|localhost):\d+$/.test(host)&&(!req.headers.origin||req.headers.origin==='http://'+host)&&(!site||['same-origin','none'].includes(site));
}
