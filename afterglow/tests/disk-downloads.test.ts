import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {unzipSync,strFromU8} from 'fflate';
// @ts-ignore Node-only download service.
import {DiskDownloads} from '../scripts/disk-downloads.mjs';
async function setup(t:any,opener:any){const root=await fs.mkdtemp(path.join(os.tmpdir(),'afterglow-disk-test-'));const manager=new DiskDownloads({root,opener});t.after(async()=>{await Promise.all([...manager.jobs.keys()].map(id=>manager.remove(id)));await fs.rm(root,{recursive:true,force:true});});return manager;}
test('磁盘打包能处理超过256MB的批次，不要求整包进入内存',async t=>{
 const chunk=Buffer.alloc(64*1024,42);
 const manager=await setup(t,async(url:string)=>({status:200,url,headers:{'content-type':'audio/mpeg'},stream:Readable.from((async function*(){for(let i=0;i<2144;i++)yield chunk;})())}));
 const id=await manager.create('大批次验证',true);
 for(let i=0;i<2;i++)await manager.addRemote(id,{index:i,title:'音频'+i,url:'https://example.com/audio.mp3'});
 assert.equal(manager.status(id).bytes,268*1024*1024);
 await manager.finish(id);const ready=manager.get(id).ready;
 assert.ok(ready.bytes>256*1024*1024);assert.equal((await fs.stat(ready.file)).size,ready.bytes);
 const file=await fs.open(ready.file,'r');try{const head=Buffer.alloc(4);await file.read(head,0,4,0);assert.equal(head.readUInt32LE(),0x04034b50);const tail=Buffer.alloc(22);await file.read(tail,0,22,ready.bytes-22);assert.equal(tail.readUInt32LE(),0x06054b50);assert.equal(tail.readUInt16LE(10),2);}finally{await file.close();}
});
test('字幕随音频保存，失败项不会混进成功文件，失败清单仍保留',async t=>{
 const manager=await setup(t,async(url:string)=>({status:url.includes('bad')?403:200,url,headers:{'content-type':'audio/mp4'},stream:Readable.from([Buffer.from([1,2,3])])}));
 const id=await manager.create('歌曲',true);
 await manager.addRemote(id,{index:0,title:'中文/歌名',url:'https://example.com/good',subtitles:[{format:'lrc',text:'[00:01.00]歌词'}]});
 await assert.rejects(()=>manager.addRemote(id,{index:1,title:'失败',url:'https://example.com/bad'}),/403/);
 await manager.finish(id,['失败：HTTP 403']);
 const files=unzipSync(await fs.readFile(manager.get(id).ready.file));
 assert.deepEqual(files['001 中文_歌名.m4a'],new Uint8Array([1,2,3]));assert.equal(strFromU8(files['001 中文_歌名.lrc']),'[00:01.00]歌词');assert.ok(files['下载失败清单.txt']);assert.equal(Object.keys(files).length,3);
});
test('取消磁盘下载会中断流并清理临时数据',async t=>{
 let began!:()=>void;const ready=new Promise<void>(resolve=>{began=resolve;});
 const manager=await setup(t,async(url:string)=>({status:200,url,headers:{'content-type':'audio/mpeg'},stream:Readable.from((async function*(){yield Buffer.alloc(1024);began();for(let i=0;i<100;i++){await new Promise(resolve=>setTimeout(resolve,2));yield Buffer.alloc(1024);}})())}));
 const id=await manager.create('取消测试',true),dir=manager.get(id).dir;
 const pending=manager.addRemote(id,{index:0,title:'测试',url:'https://example.com/test'});const rejected=assert.rejects(pending);await ready;await manager.remove(id);await rejected;
 assert.equal(manager.jobs.has(id),false);await assert.rejects(()=>fs.stat(dir),/ENOENT/);
});
test('本地文件经流式上传后可以直接保存，私有URL不能让服务代读',async t=>{
 const manager=await setup(t,()=>{throw new Error('不应发起网络请求');});
 const id=await manager.create('本地',false),token=manager.prepareLocal(id,{index:0,title:'本地音频',fileName:'local.flac',mime:'audio/flac'});
 await manager.upload(id,token,Readable.from([Buffer.from([5,6,7])]));await manager.finish(id);
 assert.equal(manager.get(id).ready.name,'本地音频.flac');assert.deepEqual(await fs.readFile(manager.get(id).ready.file),Buffer.from([5,6,7]));
 const other=await manager.create('安全检查',true);await assert.rejects(()=>manager.addRemote(other,{index:0,title:'非法',url:'http://127.0.0.1/private'}),/禁止/);
});
