// Local diagnostic: user scripts are read from the supplied folder, never bundled.
import fs from 'node:fs/promises';
import path from 'node:path';
import {newQuickJSAsyncWASMModuleFromVariant} from 'quickjs-emscripten-core';
import variant from '@jitl/quickjs-wasmfile-release-asyncify';
import {executeResource} from '../src/resources/sandbox.ts';
import {createResourceDom} from '../src/resources/dom.ts';
import {readPublic} from './public-network.mjs';
const [folder,shard='0',count='1']=process.argv.slice(2);
const manifest=JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8'));
const scripts=await Promise.all(manifest.scripts.map(async(name)=>({name,code:await fs.readFile(path.join(folder,name),'utf8')})));
const pkg={id:'audit',name:manifest.name,version:manifest.version,scripts,sources:[],importedAt:0};
const engine=await newQuickJSAsyncWASMModuleFromVariant(variant);
const bootstrap=await fs.readFile(new URL('../src/resources/bootstrap.js',import.meta.url),'utf8');
async function run(method,id,args=[]) {
 const {dom,clear}=createResourceDom(()=> 'Mozilla/5.0');let requests=0;
 const request=async(url,options={},readBody=true)=>{
  if(++requests>24)throw new Error('请求次数过多');
  if(options.headers&&Object.keys(options.headers).some(k=>/^cookie$/i.test(k)&&options.headers[k]))throw new Error('需要登录会话');
  const r=await readPublic(url,{...options,readBody,headers:{...(options.body?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...options.headers},signal:AbortSignal.timeout(10000)});
  return {status:r.status,url:r.url,body:new TextDecoder(options.encoding||'utf-8').decode(r.body),headers:r.headers};
 };
 const io=async(op,args)=>{
  if(op==='sleep')return null;
  if(op==='strings')return Promise.all(args[0].map(async(url,i)=>{try{return(await request(url,Array.isArray(args[1])?args[1][i]:args[1])).body;}catch{return null;}}));
  const r=await request(args[0],args[1],op!=='status'&&op!=='finalUrl');
  if(op==='status')return r.status;if(op==='fetch')return r;if(r.status<200||r.status>=300)throw new Error('HTTP '+r.status);if(op==='finalUrl')return r.url;return r.body;
 };
 try{return await executeResource(engine,bootstrap,pkg,method,id,args,{dom,io});}finally{clear();}
}
const sources=await run('inspect','');
for(let i=0;i<sources.length;i++){
 if(i%Number(count)!==Number(shard) || (process.argv[5] && !process.argv[5].split(',').includes(sources[i].name)))continue;
 const source=sources[i],result={name:source.name,id:source.id};
 try{
  const menus=await run('categoryMenus',source.id),tab=menus.find(m=>m.tabs?.length)?.tabs[0];result.menus=menus.length;
  const page=tab?await run('categoryPage',source.id,[tab.url]):await run('search',source.id,['相声',1]);result.books=page.books?.length||0;
  const first=page.books?.[0];
  if(first){const detail=await run('bookDetail',source.id,[first.bookUrl,true,false]);result.episodes=detail.episodes?.length||0;
   const episode=detail.episodes?.find(e=>e.isFree!==false);
   if(episode){try{const audio=await run('audio',source.id,[episode.url]);result.audio=!!audio?.url;result.audioHeaders=Object.keys(audio.headers||{});}catch(e){result.audioError=e.message;}}
  }
 }catch(e){result.error=e.message;}
 console.log(JSON.stringify(result));
}
