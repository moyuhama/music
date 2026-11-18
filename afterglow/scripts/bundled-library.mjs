import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseFile} from 'music-metadata';
const root=fileURLToPath(new URL('../public/music/',import.meta.url));
const audio=/\.(mp3|m4a|flac|wav|ogg|opus|aac|aiff|webm)$/i;
export async function bundledFile(relative,musicRoot=root){
 const file=path.resolve(musicRoot,relative);if(!file.startsWith(path.resolve(musicRoot)+path.sep)||!audio.test(file))throw new Error('本地音乐路径无效');
 const real=await fs.realpath(file),base=await fs.realpath(musicRoot);if(!real.startsWith(base+path.sep))throw new Error('本地音乐路径无效');return real;
}
let cached=null,scanned=0,cachedRoot="";
export async function scanBundledLibrary(force=false,musicRoot=root){
 if(cached&&cachedRoot===musicRoot&&!force&&Date.now()-scanned<5000)return cached;
 const files=[];
 async function walk(folder){for(const entry of await fs.readdir(folder,{withFileTypes:true}).catch(()=>[])){if(entry.name.startsWith('.'))continue;const file=path.join(folder,entry.name);if(entry.isDirectory())await walk(file);else if(entry.isFile()&&audio.test(entry.name))files.push(file);}}
 await walk(musicRoot);files.sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true}));const rows=[];
 for(const file of files){
  const relative=path.relative(musicRoot,file).split(path.sep).join('/'),folder=path.dirname(file),stem=path.basename(file,path.extname(file));
  let metadata;try{metadata=await parseFile(file,{skipCovers:true});}catch{}
  const parts=relative.split('/');const album=metadata?.common.album||(parts.length>1?parts.at(-2):'本地音乐');
  const artist=metadata?.common.artist||(/郭德纲/.test(stem)?(/于谦/.test(stem)?'郭德纲 / 于谦':'郭德纲'):'未知歌手');
  let cover;
  for(const name of ['cover.jpg','cover.png','folder.jpg','cover.webp']){try{await fs.access(path.join(folder,name));cover='music/'+path.relative(musicRoot,path.join(folder,name)).split(path.sep).map(encodeURIComponent).join('/');break;}catch{}}
  const subtitles=[];let lyricText;
  for(const format of ['lrc','srt','vtt','txt']){const sidecar=path.join(folder,stem+'.'+format);try{if((await fs.stat(sidecar)).size>2*1024*1024)continue;const text=await fs.readFile(sidecar,'utf8');if(format==='lrc')lyricText=text;else subtitles.push({text,format});}catch{}}
  rows.push({id:'bundled-'+createHash('sha256').update(relative).digest('hex').slice(0,24),title:metadata?.common.title||stem,artist,album,duration:metadata?.format.duration,cover,path:relative,url:'music/'+relative.split('/').map(encodeURIComponent).join('/'),lyricText,subtitles});
 }
 cached={tracks:rows};cachedRoot=musicRoot;scanned=Date.now();return cached;
}
const mime={'.mp3':'audio/mpeg','.m4a':'audio/mp4','.flac':'audio/flac','.wav':'audio/wav','.ogg':'audio/ogg','.opus':'audio/ogg','.aac':'audio/aac','.webm':'audio/webm','.aiff':'audio/aiff','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.lrc':'text/plain; charset=utf-8','.srt':'text/plain; charset=utf-8','.vtt':'text/vtt; charset=utf-8'};
export async function handleBundledLibrary(req,res){
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/__afterglow/library'){try{const data=await scanBundledLibrary(url.searchParams.get("force")==="1");res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}catch{res.writeHead(500);res.end();}return true;}
 if(!url.pathname.startsWith('/music/')||url.pathname==='/music/catalog.json')return false;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return true;}
 try{
  const file=path.resolve(root,decodeURIComponent(url.pathname.slice(7)));const real=await fs.realpath(file),base=await fs.realpath(root);
  if(!file.startsWith(root)||!real.startsWith(base+path.sep)||!mime[path.extname(real).toLowerCase()])throw new Error();
  const stat=await fs.stat(real);let start=0,end=stat.size-1,status=200;
  if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m)throw new Error();start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));if(start>end||start>=stat.size){res.writeHead(416);res.end();return true;}status=206;}
  const headers={'Content-Type':mime[path.extname(real).toLowerCase()],'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
  res.writeHead(status,headers);if(req.method==='HEAD'){res.end();return true;}const stream=createReadStream(real,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 }catch{res.writeHead(404);res.end('Not found');}return true;
}
export function bundledLibraryPlugin(){return{name:'afterglow-bundled-catalog',async generateBundle(){this.emitFile({type:'asset',fileName:'music/catalog.json',source:JSON.stringify(await scanBundledLibrary(true))});}};}
