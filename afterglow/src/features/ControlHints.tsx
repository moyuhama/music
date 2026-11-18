import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
export default function ControlHints({children}:{children:React.ReactNode}) {
  const [hint,setHint]=useState<{text:string;left:number;top:number}|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null),anchor=useRef<Element|null>(null),id=useId();
  function hide(){if(timer.current)clearTimeout(timer.current);timer.current=null;anchor.current=null;setHint(null);}
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  function show(target:EventTarget|null,immediate=false){
    const button=target instanceof Element?target.closest('button, summary'):null;
    if(!button || button.getAttribute("aria-expanded") === "true"){hide();return;}
    if(anchor.current===button)return;
    hide();anchor.current=button;
    const text=button.getAttribute('data-tip')||button.getAttribute('aria-label')||button.textContent?.trim();
    if(!text)return;
    const place=()=>{const box=button.getBoundingClientRect();setHint({text,left:Math.max(112,Math.min(window.innerWidth-112,box.left+box.width/2)),top:box.top-9});};
    if(immediate)place();else timer.current=setTimeout(place,300);
  }
  return <div className="control-hint-scope" onPointerOver={event=>{if(event.pointerType!=='touch')show(event.target);}} onPointerOut={event=>{if(!(event.relatedTarget instanceof Node)||!anchor.current?.contains(event.relatedTarget))hide();}} onPointerLeave={hide} onPointerDownCapture={hide} onClickCapture={hide} onFocusCapture={event=>show(event.target,true)} onBlurCapture={hide} onKeyDownCapture={event=>{if(event.key==='Escape')hide();}}>
    {children}{hint&&createPortal(<div className="control-hint" role="tooltip" id={id} style={{left:hint.left,top:hint.top}}>{hint.text}</div>,document.body)}
  </div>;
}
