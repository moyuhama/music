import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Volume2,VolumeX} from 'lucide-react';
import {player} from '../player/engine';
export default function VolumeControl({volume,transport=false,rememberedVolume}:{volume:number;transport?:boolean;rememberedVolume:{current:number}}){
 const [open,setOpen]=useState(false),[place,setPlace]=useState({left:0,bottom:0,color:'#756b55'});
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),lastVolume=rememberedVolume,touch=useRef(false),skipFocus=useRef(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const cancel=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;};
 const show=()=>{cancel();setOpen(true);};
 const leave=()=>{cancel();timer.current=setTimeout(()=>setOpen(false),140);};
 useEffect(()=>()=>cancel(),[]);
 useEffect(()=>{if(volume>0)lastVolume.current=volume;},[volume]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!panel.current?.contains(event.target as Node)){cancel();setOpen(false);}};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();cancel();setOpen(false);if(document.activeElement!==trigger.current){skipFocus.current=true;trigger.current?.focus();}}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);};
 },[open]);
 useLayoutEffect(()=>{
  if(!open)return;
  const position=()=>{const button=trigger.current;if(!button)return;const box=button.getBoundingClientRect();setPlace({left:Math.max(24,Math.min(innerWidth-24,box.left+box.width/2)),bottom:innerHeight-box.top+10,color:getComputedStyle(button).getPropertyValue('--cover-panel').trim()||'#756b55'});};
  position();window.addEventListener('resize',position);return()=>window.removeEventListener('resize',position);
 },[open]);
 function blur(target:EventTarget|null){if(!(target instanceof Node)||(!trigger.current?.contains(target)&&!panel.current?.contains(target))){cancel();setOpen(false);}}
 function change(value:number){if(value)lastVolume.current=value;player.setVolume(value);}
 return <div className="volume-control" onPointerEnter={event=>{if(event.pointerType!=='touch')show();}} onPointerLeave={leave}>
  <button ref={trigger} className={transport?'transport-icon':'icon-button'} aria-label={volume?'静音':'取消静音'} data-no-tip="true" aria-expanded={open} aria-controls={id}
   onFocus={()=>{if(skipFocus.current)skipFocus.current=false;else if(!touch.current)show();}} onBlur={event=>blur(event.relatedTarget)}
   onPointerDown={event=>{touch.current=event.pointerType==='touch';}}
   onKeyDown={event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();show();change(Math.max(0,Math.min(1,volume+(event.key==='ArrowUp' ? 0.05 : -0.05))));}}}
   onClick={()=>{if(touch.current){cancel();setOpen(!open);}else if(volume){lastVolume.current=volume;player.setVolume(0);}else player.setVolume(lastVolume.current||.7);}}>
   {volume?<Volume2 size={19}/>:<VolumeX size={19}/>}
  </button>
  {open&&createPortal(<div ref={panel} id={id} className="volume-panel" role="group" aria-label="音量调节" style={{left:place.left,bottom:place.bottom,backgroundColor:place.color}} onPointerEnter={cancel} onPointerLeave={leave} onFocusCapture={cancel} onBlurCapture={event=>blur(event.relatedTarget)}>
   <input aria-label="音量" aria-orientation="vertical" aria-valuetext={`${Math.round(volume*100)}%`} type="range" min="0" max="1" step="0.01" value={volume} onChange={event=>change(Number(event.target.value))} style={{'--volume':`${volume*100}%`} as React.CSSProperties}/>
  </div>,document.body)}
 </div>;
}
