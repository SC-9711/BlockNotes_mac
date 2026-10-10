import {useEffect,useState,useRef} from 'react'
import {resource} from './minecraft/model'
import {renderBlockItem,type BlockItem} from './minecraft/gui'
export type IconName='quill'|'tag'|'compass'|'book'|'chest'|'shelf'|'gear'|'leaf'|'lectern'|'jukebox'
const shapes:Record<Exclude<IconName,'lectern'|'jukebox'>,[string,string][]>= {
 quill:[['#4d3427','M2 3h9v11H2z'],['#985b37','M3 4h7v9H3z'],['#eee1b7','M4 4h6v8H4z'],['#bbaf89','M5 5h4v1H5zm0 3h3v1H5z'],['#d9e4df','M11 1h4v4h-2v3h-2v3H9V8h1V5h1z'],['#708480','M11 5h1v4h-1v2H9v2H8v-2h1V9h1V7h1z']],
 tag:[['#4c3a25','M1 5h3V3h9v2h2v7h-2v2H4v-2H1z'],['#ccb384','M3 6h3V5h6v1h1v5h-1v1H6v-1H3z'],['#685332','M4 7h2v2H4z'],['#9b855c','M8 7h4v1H8zm0 3h3v1H8z']],
 compass:[['#343939','M5 1h6v2h3v3h1v5h-2v3h-3v1H5v-2H2v-3H1V5h2V2h2z'],['#b5c0b8','M5 3h6v2h2v6h-2v2H5v-2H3V5h2z'],['#545e5c','M6 4h4v1h2v5h-2v2H5v-2H4V6h2z'],['#d96c58','M10 4v5H7V7h1V5h1V4z'],['#e3dbc7','M6 8h3v2H8v2H6z']],
 book:[['#392c26','M3 2h10v13H3z'],['#527768','M4 2h8v11H4z'],['#355748','M4 2h2v11H4z'],['#e3d4a6','M5 13h7v1H5zm2-9h4v1H7zm0 2h3v1H7z'],['#b3b270','M7 10h4v1H7z']],
 chest:[['#3e2c20','M1 5h14v9H1z'],['#a46d32','M2 6h12v7H2z'],['#d49b4c','M2 4h12v3H2z'],['#493722','M2 8h12v1H2z'],['#e4d19c','M7 7h2v4H7z'],['#735028','M3 10h1v3H3zm9 0h1v3h-1z']],
 shelf:[['#5b3a24','M1 2h14v13H1z'],['#be8e54','M2 3h12v4H2zm0 6h12v4H2z'],['#4e7261','M3 3h2v4H3zm6 6h2v4H9z'],['#ab5950','M6 3h2v4H6zm-3 6h2v4H3z'],['#e1c17a','M9 3h3v4H9zm-3 6h2v4H6z']],
 gear:[['#c7c9b6','M6 1h4v3h3v2h2v4h-2v3h-3v2H6v-2H3v-3H1V6h2V3h3z'],['#5f695c','M6 5h4v1h1v4h-1v1H6v-1H5V6h1z'],['#c7c9b6','M7 7h2v2H7z']],
 leaf:[['#374b2d','M3 2h10v10H8v3H6v-3H3z'],['#72914b','M4 3h8v3H4zm1 3h7v5H5z'],['#abc56d','M5 4h5v1H5z']]
}
const itemFiles:Partial<Record<IconName,string>>={quill:'writable_book',tag:'name_tag',compass:'compass_16',book:'written_book'}
export default function Icon({name,className=''}:{name:IconName;className?:string}){
 const [image,setImage]=useState(''),holder=useRef<HTMLSpanElement>(null)
 useEffect(()=>{
  if(!['shelf','chest','lectern','jukebox'].includes(name)||!holder.current)return
  let active=true,generation=0
  const resize=()=>{const size=Math.max(16,Math.round(holder.current!.getBoundingClientRect().width*devicePixelRatio)),current=++generation;renderBlockItem(name as BlockItem,size).then(url=>{if(active&&generation===current)setImage(url)}).catch(()=>{})}
  const observer=new ResizeObserver(resize);observer.observe(holder.current);resize()
  return()=>{active=false;observer.disconnect()}
 },[name])
 const file=itemFiles[name];if(file||image)return <span ref={holder} data-item={name} className={'pixel-icon '+className}><img alt="" aria-hidden="true" draggable={false} width="100%" height="100%" src={file?resource('textures/item/'+file+'.png'):image}/></span>
 return <span ref={holder} data-item={name} className={'pixel-icon '+className}><svg width="100%" height="100%" aria-hidden="true" viewBox="0 0 16 16" shapeRendering="crispEdges">{(shapes[name==='lectern'||name==='jukebox'?'book':name]).map(([fill,d],i)=><path key={i} fill={fill} d={d}/>)}</svg></span>
}
