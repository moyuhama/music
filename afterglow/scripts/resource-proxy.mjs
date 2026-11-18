import {readPublic,localRequest} from './public-network.mjs';
let pending=0;
export async function handleResourceProxy(req,res,reader=readPublic) {
  if(new URL(req.url,'http://127.0.0.1').pathname!=='/__afterglow/resource')return false;
  const fail=(code,error)=>{if(res.destroyed)return;res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','X-Afterglow-Error':'1','Cache-Control':'no-store'});res.end(JSON.stringify({error}));};
  if(!localRequest(req)){fail(403,'仅允许本机播放器调用音源服务');return true;}
  if(req.method!=='POST'){fail(405,'请求方式不支持');return true;}
  if(pending>=8){fail(429,'本地音源请求过多，请稍后重试');return true;}
  pending++;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000),close=()=>controller.abort();res.on('close',close);
  try{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>128*1024)throw new Error('音源请求过大');chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(typeof input.url!=='string'||!['GET','POST','HEAD'].includes(input.method||'GET')||(input.body!=null&&typeof input.body!=='string'))throw new Error('音源请求参数无效');
    const result=await reader(input.url,{method:input.method||'GET',headers:input.headers,body:input.body,readBody:input.readBody!==false,signal:controller.signal});
    res.writeHead(result.status,{'Content-Type':result.headers['content-type']||'application/octet-stream','X-Afterglow-Url':encodeURIComponent(result.url),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(result.body);
  }catch(error){fail(502,controller.signal.aborted?'音源请求超时或已取消':error.code==='ENOTFOUND'?'音源域名无法解析':error.code==='ECONNRESET'?'音源网站中断了连接，请稍后重试':/CERT|TLS/.test(error.code||'')?'源站安全连接或证书异常':error.message||'本地服务无法读取音源');}
  finally{pending--;clearTimeout(timer);res.off('close',close);controller.abort();}
  return true;
}
