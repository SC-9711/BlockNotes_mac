import {useLayoutEffect,useRef,useState} from 'react'
export type TooltipItem={name:string;detail:string;x:number;y:number}
export default function ItemTooltip({item}:{item:TooltipItem}){
 const ref=useRef<HTMLDivElement>(null),[position,setPosition]=useState({left:item.x+12,top:item.y-80})
 useLayoutEffect(()=>{const size=ref.current?.getBoundingClientRect();if(!size)return;setPosition({left:Math.max(8,Math.min(item.x+12,innerWidth-size.width-8)),top:Math.max(8,item.y-size.height-12)})},[item])
 return <div ref={ref} role="tooltip" id="hotbar-tooltip" className="mc-tooltip" style={position}><span>{item.name}</span><small>{item.detail}</small></div>
}
