import test from 'node:test';import assert from 'node:assert/strict';
import {neteaseSongId,normalizeNeteaseLyrics,fetchNeteaseLyrics} from '../src/resources/lyrics.ts';
import type {Track} from '../src/domain/types.ts';
const track:Track={id:'song',title:'歌曲',artist:'歌手',source:{kind:'remote',url:'https://cdn.example/song.mp3'},origin:{kind:'resource',packageId:'pkg',sourceId:'ncm',itemUrl:'https://music.163.com/song?id=123'},addedAt:0,favorite:false,persist:false};
test('只按网易云单曲ID获取歌词，不拿相似歌名或其它网站匹配',()=>{
 assert.equal(neteaseSongId(track),'123');
 assert.equal(neteaseSongId({...track,origin:{...track.origin as Extract<NonNullable<Track['origin']>,{kind:'resource'}>,itemUrl:'https://music.163.com/#/song?id=456'}}),'456');
 for(const url of ['https://music.163.com/playlist?id=123','https://music.163.com.evil.example/song?id=123','https://www.ximalaya.com/sound/123','https://music.163.com/song?id=bad'])assert.equal(neteaseSongId({...track,origin:{kind:'resource',packageId:'pkg',sourceId:'ncm',itemUrl:url}}),null);
 assert.equal(neteaseSongId({...track,origin:undefined}),null);
});
test('同步歌词可解析，纯音乐、空响应、未收录和没有时间轴均保持不展示',()=>{
 const value=normalizeNeteaseLyrics({code:200,lrc:{lyric:'[00:01.50]第一句\n[00:04.00]第二句'}});
 assert.equal(value?.lyrics[0].time,1.5);assert.equal(value?.lyrics[1].text,'第二句');
 for(const data of [{code:200,nolyric:true},{code:200,uncollected:true},{code:403},{code:200,lrc:{lyric:''}},{code:200,lrc:{lyric:'没有时间轴'}},{code:200,lrc:{lyric:'[99:00.00]纯音乐，请欣赏'}}])assert.equal(normalizeNeteaseLyrics(data),null);
});
test('歌词使用现有本机请求服务；请求失败不抛播放错误，取消后不采用过期结果',async()=>{
 let endpoint='',input:any;
 const mock:typeof fetch=async(url,options)=>{endpoint=String(url);input=JSON.parse(String(options?.body));return new Response(JSON.stringify({code:200,lrc:{lyric:'[00:01]同步歌词'}}));};
 const signal=new AbortController().signal,result=await fetchNeteaseLyrics('123',signal,mock,true);
 assert.equal(endpoint,'/__afterglow/resource');assert.equal(new URL(input.url).searchParams.get('id'),'123');assert.equal(result?.lyrics.length,1);assert.equal(input.headers.Referer,'https://music.163.com/');
 const failed:typeof fetch=async()=>new Response('源站拒绝',{status:403});assert.equal(await fetchNeteaseLyrics('123',signal,failed,true),null);
 const controller=new AbortController();const pending=fetchNeteaseLyrics('123',controller.signal,async()=>{controller.abort();return new Response('{}');},true);await assert.rejects(pending);
});
