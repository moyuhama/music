import {useEffect,useLayoutEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check} from 'lucide-react';
import {player} from '../player/engine';
import {PLAYBACK_RATES} from '../player/rate';
export default function PlaybackRate({rate}:{rate:number}) {
  const [open,setOpen]=useState(false),[place,setPlace]=useState({bottom:100,right:20});
  const id=useId(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!panel.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);trigger.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);};
  },[open]);
  useLayoutEffect(()=>{
    if(!open)return;
    const update=()=>{const button=trigger.current?.getBoundingClientRect();if(button)setPlace({bottom:Math.max(12,window.innerHeight-button.top+10),right:Math.max(12,Math.min(window.innerWidth-180,window.innerWidth-button.right))});};
    update();panel.current?.querySelector<HTMLInputElement>('input:checked')?.focus();window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update);
  },[open]);
  return <div className="playback-rate"><button ref={trigger} className="playback-rate-trigger" aria-label={`播放速度，当前 ${rate} 倍`} data-tip="播放速度" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>{rate}×</button>
    {open&&createPortal(<div ref={panel} id={id} className="playback-rate-panel" role="dialog" aria-label="播放速度" style={{bottom:place.bottom,right:place.right}}><fieldset><legend>播放速度</legend>{PLAYBACK_RATES.map(value=><label key={value} className={value===rate?'selected':''}><input type="radio" name={id} value={value} checked={value===rate} onChange={()=>{player.setPlaybackRate(value);setOpen(false);trigger.current?.focus();}}/><span>{value}×{value===1?' 正常速度':''}</span>{value===rate&&<Check size={14}/>}</label>)}</fieldset></div>,document.body)}
  </div>;
}
