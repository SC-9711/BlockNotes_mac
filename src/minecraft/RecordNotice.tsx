import {useEffect,useState} from 'react'

// Vanilla action-bar placement, colored text and short fade, without a panel.
// Time counts only while the room is visible, so choosing a disc inside the
// container still produces the notification when the player returns home.
export default function RecordNotice({event,title,hidden,playing}:{event:{id:string;serial:number}|null;title:string;hidden:boolean;playing:boolean}){
 const [elapsed,setElapsed]=useState(3000)
 useEffect(()=>{if(event)setElapsed(0)},[event?.serial])
 const active=elapsed<3000
 useEffect(()=>{if(hidden||!playing||!active)return;const timer=setInterval(()=>setElapsed(value=>Math.min(3000,value+50)),50);return()=>clearInterval(timer)},[hidden,playing,active])
 if(!event||hidden||!playing||!active)return null
 return <div className="record-notice" role="status" style={{color:`hsl(${(3000-elapsed)/2500*360},54%,39%)`,opacity:Math.min(1,(3000-elapsed)/1000)}}>正在播放：{title}</div>
}
