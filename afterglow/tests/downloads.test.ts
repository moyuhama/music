import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import {safeName,sidecars,DownloadZip,audioExtension,lrcText} from "../src/downloads/files.ts";
// @ts-ignore Tested server implementation is shared by start/dev/preview.
import {audioTarget} from "../scripts/audio-download.mjs";
test("下载文件名去除路径和非法字符，保留中文",()=>{
  assert.equal(safeName('../歌名:a/b?. '),'.._歌名_a_b_');
  assert.equal(audioExtension('https://example.com/song?sign=1','audio/mp4'),'m4a');
});
test("歌词导出保留原文；只有时间轴时生成可解析的同名 LRC 内容",()=>{
  assert.deepEqual(sidecars({url:'x',lyricText:'[00:01.20]原歌词'}),[{text:'[00:01.20]原歌词',format:'lrc'}]);
  assert.equal(lrcText([{time:59.999,text:'换分钟'},{time:61.2,text:'中文'}]),'[01:00.00]换分钟\n[01:01.20]中文');
  assert.deepEqual(sidecars({url:'x'}),[]);
  assert.equal(sidecars({url:'x',subtitles:[{text:'WEBVTT\n\n00:00.000 --> 00:01.000\n字幕',format:'vtt'}]})[0].format,'vtt');
});
test("批量 ZIP 可解压，音频字节不变，歌词与字幕和音频同名",async()=>{
  const zip=new DownloadZip();
  const audio=new Uint8Array([1,2,3,4]);
  zip.add('001 歌名.m4a',audio);zip.text('001 歌名.lrc','[00:01.00]歌词');zip.add('002 歌名.m4a',audio);zip.text('002 歌名.srt','1\n00:00:00,000 --> 00:00:01,000\n字幕');zip.text('下载失败清单.txt','失败章节：无法读取');
  const files=unzipSync(new Uint8Array(await zip.finish().arrayBuffer()));
  assert.deepEqual(files['001 歌名.m4a'],audio);
  assert.equal(strFromU8(files['001 歌名.lrc']),'[00:01.00]歌词');
  assert.ok(files['002 歌名.srt']);assert.ok(files['下载失败清单.txt']);
});
test("本地下载代理拒绝私有地址、伪造域名及带凭据地址",()=>{
  assert.equal(audioTarget('https://a.xmcdn.com/audio.m4a'),'https://a.xmcdn.com/audio.m4a');
  for(const url of ['http://127.0.0.1/','https://xmcdn.com.evil.test/a','https://evilxmcdn.com/a','https://a.xmcdn.com:444/a','https://user:pass@a.xmcdn.com/a']) assert.throws(()=>audioTarget(url));
});
