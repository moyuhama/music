export function safeName(value) { return String(value).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').slice(0,140)||'音频'; }
export function audioExtension(url,mime) {
 const known={'audio/mp4':'m4a','audio/mpeg':'mp3','audio/flac':'flac','audio/x-flac':'flac','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/aac':'aac','audio/webm':'webm'};
 return known[mime.split(';')[0].toLowerCase()]||/\.(mp3|m4a|flac|wav|ogg|aac|webm|opus)$/i.exec(new URL(url,'https://example.com').pathname)?.[1].toLowerCase()||'audio';
}
