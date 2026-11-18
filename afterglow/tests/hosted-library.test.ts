import test from 'node:test';import assert from 'node:assert/strict';
import {catalogTracks,combineCatalogs} from '../src/domain/bundled-catalog.ts';
import {mergeBundled} from '../src/domain/library.ts';
test('独立曲库保留稳定标识和收藏，将本机地址迁移为Raw 音频链接',()=>{
 const row={id:'bundled-song',title:'歌曲',artist:'歌手',path:'专辑/歌曲.m4a',url:'music/song.m4a',lyricText:'[00:01]歌词'};
 const local=catalogTracks([row],'http://127.0.0.1:4173/');
 const hosted=catalogTracks([{...row,url:'https://raw.githubusercontent.com/owner/library/main/music/song.m4a',cover:'https://raw.githubusercontent.com/owner/library/main/cover.jpg'}],'https://raw.githubusercontent.com/owner/library/main/catalog.json',true);
 const combined=combineCatalogs(local,hosted);assert.equal(combined.length,1);
 const migrated=mergeBundled([{...local[0],favorite:true,lastPlayed:123}],combined,[]).tracks[0];
 assert.equal(migrated.cover,hosted[0].cover);assert.equal(migrated.favorite,true);assert.equal(migrated.lastPlayed,123);assert.equal(migrated.source.kind==='remote'&&migrated.source.url,hosted[0].source.kind==='remote'&&hosted[0].source.url);
 assert.deepEqual(migrated.origin,{kind:'bundled',path:row.path,hosted:true});assert.equal(migrated.lyrics?.[0].text,'歌词');
});
test('远端曲库拒绝脚本地址，支持Pages相对路径和新曲目合并',()=>{
 const row={id:'song',title:'song',artist:'artist',path:'song.mp3',url:'music/song.mp3'};
 assert.equal(catalogTracks([row],'https://example.com/music/')[0].source.kind==='remote',true);
 assert.throws(()=>catalogTracks([{...row,url:'javascript:alert(1)'}],'https://example.com/'),/无效/);
 assert.equal(combineCatalogs(catalogTracks([row],'https://example.com/'),catalogTracks([{...row,id:'new'}],'https://example.com/',true)).length,2);
});
