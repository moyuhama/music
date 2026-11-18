import {handleResourceProxy} from './resource-proxy.mjs';
import {handleAudioDownload} from './audio-download.mjs';
import {handleXimalayaProxy} from './ximalaya-proxy.mjs';
export function localSourceProxyPlugin() {
  const install=server=>{server.middlewares.use((req,res,next)=>{
    void (async()=>{if(!await handleResourceProxy(req,res)&&!await handleAudioDownload(req,res)&&!await handleXimalayaProxy(req,res))next();})().catch(next);
  });};
  return {name:'afterglow-local-sources',configureServer:install,configurePreviewServer:install};
}
