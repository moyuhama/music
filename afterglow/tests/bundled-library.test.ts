import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
// @ts-ignore Local music folder reader is shared by build and service.
import {scanBundledLibrary,bundledFile} from '../scripts/bundled-library.mjs';
test('自动索引专辑目录、歌词和封面，标识稳定，拒绝越界路径',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'afterglow-library-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const album=path.join(root,'我的专辑');await fs.mkdir(album);await fs.writeFile(path.join(album,'歌曲一.m4a'),Buffer.from('audio-fixture'));await fs.writeFile(path.join(album,'歌曲一.lrc'),'[00:01.00]歌词');await fs.writeFile(path.join(album,'cover.jpg'),Buffer.from([1,2,3]));
 const first=await scanBundledLibrary(true,root);assert.equal(first.tracks.length,1);const track=first.tracks[0];assert.equal(track.album,'我的专辑');assert.equal(track.title,'歌曲一');assert.equal(track.lyricText,'[00:01.00]歌词');assert.ok(track.cover.endsWith('cover.jpg'));assert.equal(track.path,'我的专辑/歌曲一.m4a');
 assert.equal((await scanBundledLibrary(true,root)).tracks[0].id,track.id);assert.equal(await bundledFile(track.path,root),await fs.realpath(path.join(album,'歌曲一.m4a')));
 await assert.rejects(()=>bundledFile('../private.m4a',root),/无效/);
});
