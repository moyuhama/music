import {test} from 'node:test';import assert from 'node:assert/strict';
import {mergeCatalog} from '../src/domain/catalog.ts';import type {Track} from '../src/domain/types.ts';
const track:Track={id:'user',title:'歌曲',artist:'歌手',source:{kind:'remote',url:'https://example.com/song.mp3'},addedAt:0,favorite:true,persist:true};
test('首次进入不再自动添加演示专辑',()=>{assert.equal(mergeCatalog([],[]).tracks.length,0);});
test('旧版两组演示曲目清理后不会再出现，用户文件、收藏和手动直链保留',()=>{
 const result=mergeCatalog([{...track,id:'sample-city'},{...track,id:'scott-buckley-solace'},track,{...track,id:'manual',album:'Creative Commons Music Library'}],[]);
 assert.deepEqual(result.tracks.map(t=>t.id),['user','manual']);assert.equal(result.tracks[0].favorite,true);
 assert.deepEqual(mergeCatalog(result.tracks,result.catalogIds).tracks,result.tracks);
});
