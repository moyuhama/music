import {useEffect,useRef,useState} from 'react';
import {X,ImagePlus} from 'lucide-react';
import type {AlbumInfo} from '../domain/types';
export function AlbumFields({info,onChange}:{info:AlbumInfo;onChange(info:AlbumInfo):void}){
 const [error,setError]=useState('');
 const latestInfo=useRef(info);latestInfo.current=info;
 return <div className="album-fields">
  <label>专辑名称<input required maxLength={100} value={info.name} onChange={event=>onChange({...info,name:event.target.value})} placeholder="填写专辑名称"/></label>
  <label>歌手 / 演出者<input maxLength={100} value={info.artist??''} onChange={event=>onChange({...info,artist:event.target.value})} placeholder="可选，留空时读取音乐文件信息"/></label>
  <div className="album-cover-field">
   {info.cover?<img src={info.cover} alt="专辑封面"/>:<span className="album-cover-placeholder"><ImagePlus size={26}/></span>}
   <div><label className="album-cover-picker">选择封面<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async event=>{
    const file=event.target.files?.[0];if(!file)return;setError('');
    if(file.size>3*1024*1024){setError('请选择小于 3 MB 的封面');return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('请选择 JPG、PNG 或 WebP 图片');return;}
    try{const cover=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});onChange({...latestInfo.current,cover});}catch{setError('封面读取失败，请重新选择');}
   }}/></label><small>JPG / PNG / WebP · 最大 3 MB</small>{info.cover&&<button type="button" onClick={()=>onChange({...info,cover:undefined})}>移除封面</button>}</div>
  </div>
  {error&&<p role="alert">{error}</p>}
 </div>;
}
export function CreateAlbumDialog({onClose,onCreate}:{onClose():void;onCreate(info:AlbumInfo):void}){
 const ref=useRef<HTMLDialogElement>(null),[info,setInfo]=useState<AlbumInfo>({name:''}),[error,setError]=useState('');
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog className="form-dialog album-dialog" ref={ref} onCancel={onClose}><form onSubmit={event=>{event.preventDefault();try{onCreate({...info,name:info.name.trim(),artist:info.artist?.trim()||undefined});}catch(error){setError(error instanceof Error?error.message:'创建失败');}}}>
  <div className="dialog-title"><h2>新建专辑</h2><button type="button" className="icon-button" aria-label="关闭" onClick={onClose}><X size={18}/></button></div>
  <AlbumFields info={info} onChange={setInfo}/>{error&&<p role="alert">{error}</p>}
  <div className="collection-dialog-actions"><button type="button" onClick={onClose}>取消</button><button className="primary" type="submit">创建专辑</button></div>
 </form></dialog>;
}
export function ImportAlbumDialog({files,albums,initialAlbum,onClose,onImport}:{files:File[];albums:AlbumInfo[];initialAlbum?:string;onClose():void;onImport(album:AlbumInfo,create:boolean):Promise<void>}){
 const ref=useRef<HTMLDialogElement>(null),[selected,setSelected]=useState(initialAlbum?'album:'+initialAlbum:''),[info,setInfo]=useState<AlbumInfo>({name:''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{ref.current?.showModal();},[]);
 const target=selected==='__new__'?info:albums.find(album=>'album:'+album.name===selected);
 return <dialog className="form-dialog album-dialog" ref={ref} onCancel={event=>{if(busy)event.preventDefault();else onClose();}}><form onSubmit={async event=>{event.preventDefault();if(!target||!target.name.trim())return;setBusy(true);setError('');try{await onImport({...target,name:target.name.trim(),artist:target.artist?.trim()||undefined},selected==='__new__');}catch(error){setError(error instanceof Error?error.message:'导入失败');setBusy(false);}}}>
  <div className="dialog-title"><h2>导入音乐</h2><button type="button" disabled={busy} className="icon-button" aria-label="关闭" onClick={onClose}><X size={18}/></button></div>
  <p className="import-file-summary">已选择 {files.length} 个文件</p>
  <label>放入专辑<select required disabled={busy} aria-label="选择专辑" value={selected} onChange={event=>setSelected(event.target.value)}><option value="" disabled>请选择专辑</option>{albums.map(album=><option key={album.name} value={'album:'+album.name}>{album.name}</option>)}<option value="__new__">＋ 新建专辑</option></select></label>
  {selected==='__new__'&&<AlbumFields info={info} onChange={setInfo}/>}
  {target?.cover&&selected!=='__new__'&&<img className="import-album-preview" src={target.cover} alt={target.name}/>}
  {error&&<p role="alert">{error}</p>}
  <p>音乐保存在当前浏览器中。</p>
  <div className="collection-dialog-actions"><button type="button" disabled={busy} onClick={onClose}>取消</button><button className="primary" type="submit" disabled={busy||!target?.name.trim()}>{busy?'正在导入…':'导入音乐'}</button></div>
 </form></dialog>;
}
