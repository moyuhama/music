import {useEffect,useState} from 'react';
const pending = new Map<string,Promise<string|undefined>>();
function readyCover(src:string) {
  const cached=pending.get(src);if(cached)return cached;
  const task=new Promise<string|undefined>(resolve=>{
    const image=new Image();image.referrerPolicy='no-referrer';
    image.onload=()=>{void (image.decode?.()||Promise.resolve()).catch(()=>{}).then(()=>resolve(src));};
    image.onerror=()=>resolve(undefined);image.src=src;
  });
  if(pending.size>=60)pending.delete(pending.keys().next().value!);
  pending.set(src,task);return task;
}
// Retain the displayed artwork until its replacement is decoded. Rapid switches
// only commit the latest request, including when several tracks share a cover.
export function useRetainedCover(src?:string) {
  const [displayed,setDisplayed]=useState(src);
  useEffect(()=>{
    if(!src){setDisplayed(undefined);return;}
    let live=true;
    void readyCover(src).then(value=>{if(live)setDisplayed(value);});
    return()=>{live=false;};
  },[src]);
  return src ? displayed : undefined;
}
