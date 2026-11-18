import test from 'node:test';import assert from 'node:assert/strict';
import {libraryTrack,migratePlaybackHistory,mergeBundled,reconcileLegacyCatalog,remapTrackIds} from '../src/domain/library.ts';
import type {Track} from '../src/domain/types.ts';
const base:Track={id:'one',title:'歌曲',artist:'作者',album:'专辑',source:{kind:'remote',url:'https://example.com/audio.mp3'},addedAt:0,favorite:false,persist:true};
test('发现临时播放不属于音乐库，主动收藏或加入歌单后保留',()=>{
 const track:Track={...base,persist:false,origin:{kind:'resource',packageId:'pkg',sourceId:'source',itemUrl:'song:1'}};
 assert.equal(libraryTrack(track),false);assert.equal(libraryTrack({...track,persist:true}),true);assert.equal(libraryTrack(base),true);
});
test('清理可识别的旧发现播放记录，保留收藏、歌单及手动添加的远端和本地文件',()=>{
 const old={...base,id:'old',source:{kind:'remote' as const,url:'http://127.0.0.1:4173/__afterglow/audio?url=https%3A%2F%2Fexample.com'}};
 const favorite={...old,id:'favorite',favorite:true},playlist={...old,id:'playlist'};
 const file:Track={...base,id:'file',source:{kind:'local',fileKey:'key'}};
 assert.deepEqual(migratePlaybackHistory([old,favorite,playlist,base,file],[{id:'list',name:'歌单',trackIds:['playlist']}]).map(t=>t.id),['favorite','playlist','one','file']);
});
test('本地目录自动合并且不重复，保留收藏和手动移除结果，文件删除后移除索引',()=>{
 const a:Track={...base,id:'bundled-a',origin:{kind:'bundled',path:'album/a.mp3'}};
 const b:Track={...base,id:'bundled-b',origin:{kind:'bundled',path:'album/b.mp3'}};
 const first=mergeBundled([base],[a,b],[]);assert.equal(first.tracks.length,3);
 const second=mergeBundled(first.tracks.map(t=>t.id===a.id?{...t,favorite:true}:t),[a,b],first.catalogIds);assert.equal(second.tracks.length,3);assert.equal(second.tracks.find(t=>t.id===a.id)?.favorite,true);
 const removed=mergeBundled(second.tracks.filter(t=>t.id!==b.id),[a,b],second.catalogIds);assert.equal(removed.tracks.some(t=>t.id===b.id),false);
 assert.equal(mergeBundled(second.tracks,[],second.catalogIds).tracks.length,1);
});

test('旧喜马拉雅签名链接迁移至唯一匹配的固定曲库，合并重复项并保留收藏和歌单引用',()=>{
 const fresh:Track={...base,id:'bundled-song',duration:935.47,origin:{kind:'bundled',path:'song.m4a',hosted:true},source:{kind:'remote',url:'https://raw.githubusercontent.com/owner/library/main/song.m4a'}};
 const old:Track={...base,id:'expired',favorite:true,lastPlayed:123,duration:935,source:{kind:'remote',url:'https://a.xmcdn.com/song.m4a?sign=old&timestamp=1'}};
 const result=reconcileLegacyCatalog([old,{...old,id:'duplicate',favorite:false},fresh],[fresh]);
 assert.equal(result.tracks.length,1);assert.equal(result.tracks[0].id,fresh.id);assert.equal(result.tracks[0].favorite,true);assert.equal(result.tracks[0].lastPlayed,123);assert.deepEqual(result.tracks[0].source,fresh.source);
 assert.deepEqual(remapTrackIds(['expired','duplicate','bundled-song','manual'],result.aliases),['bundled-song','manual']);
 // Unknown durations, ambiguous editions and ordinary manual links are left untouched.
 for(const item of [{...old,duration:undefined},{...old,duration:500},{...old,source:base.source}])assert.equal(reconcileLegacyCatalog([item],[fresh]).aliases.size,0);
 assert.equal(reconcileLegacyCatalog([old],[fresh,{...fresh,id:'other-edition'}]).aliases.size,0);
});
