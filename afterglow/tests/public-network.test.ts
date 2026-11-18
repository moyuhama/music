import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Shared Node service code.
import {publicTarget,publicAddress,publicLookup} from '../scripts/public-network.mjs';
// @ts-ignore Shared HLS manifest rewriter.
import {rewriteHls} from '../scripts/audio-download.mjs';
import {createResourceDom} from '../src/resources/dom.ts';
test('统一服务拒绝私网、编码 IP、特殊协议与任意端口',async()=>{
 for(const value of ['http://127.0.0.1/','http://2130706433/','http://10.0.0.1/','http://169.254.169.254/','http://[::1]/','https://localhost/','https://example.com:444/','file:///etc/passwd','https://name:pass@example.com/'])assert.throws(()=>publicTarget(value));
 for(const address of ['127.0.0.1','10.1.1.1','192.168.1.1','100.64.0.1','::1','::ffff:127.0.0.1','fe80::1','2001:db8::1','2002:7f00:1::'])assert.equal(publicAddress(address),false,address);
 assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
 await assert.rejects(()=>publicLookup('localhost'),/非公开|私有/);
 assert.equal(publicTarget('https://music.163.com/api/toplist').hostname,'music.163.com');
});
test('HLS 子清单、分片和 KEY 的 URI 都保留请求头并经过本地服务',()=>{
 const text='#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:5,\nsegment.ts\n';
 const result=rewriteHls(text,'https://media.example.com/path/master.m3u8',{Referer:'https://example.com/'});
 assert.ok(result.includes('/__afterglow/audio?'));assert.ok(result.includes('key.bin'));assert.ok(result.includes('segment.ts'));assert.ok(result.includes('Referer'));
 assert.throws(()=>rewriteHls('#EXTM3U\nhttp://127.0.0.1/private','https://example.com/'));
});
test('HTML 宿主提供 tag、byId、hasClass 与非空字符串实体解码',()=>{
 const {dom}=createResourceDom(()=> 'test');const root=dom('parse',['<html><body><div id="item" class="book">A  <a href="../song"> B </a></div></body></html>','https://example.com/path/']);
 const div=dom('byId',[root,'item']);assert.equal(dom('tag',[div]),'div');assert.equal(dom('hasClass',[div,'book']),true);assert.equal(dom('text',[div]),'A B');
 assert.equal(dom('decode',['https://example.com/?a=1&amp;b=2']),'https://example.com/?a=1&b=2');assert.equal(dom('text',[0]),'');
});
// @ts-ignore Shared local service middleware.
import {handleResourceProxy} from '../scripts/resource-proxy.mjs';
import http from 'node:http';
test('统一代理保留 POST 表单、最终地址和响应状态，隔离跨站请求',async()=>{
 let calls=0;
 const server=http.createServer((req,res)=>{void handleResourceProxy(req,res,async(url:string,options:any)=>{calls++;assert.equal(options.method,'POST');assert.equal(options.body,'c=%5B%5D');return {status:200,url:'https://example.com/final',headers:{'content-type':'application/json'},body:Buffer.from('{"ok":true}')};});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const endpoint='http://127.0.0.1:'+(server.address() as {port:number}).port+'/__afterglow/resource';
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://example.com/api',method:'POST',body:'c=%5B%5D'})});
  assert.equal(response.status,200);assert.equal((await response.json()).ok,true);assert.equal(decodeURIComponent(response.headers.get('X-Afterglow-Url')!),'https://example.com/final');
  assert.equal((await fetch(endpoint,{method:'POST',headers:{Origin:'https://untrusted.example'},body:'{}'})).status,403);assert.equal(calls,1);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
