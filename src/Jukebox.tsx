import {useState} from 'react'
import Icon from './Icon'
import {type useMusic} from './minecraft/music'
import {resource} from './minecraft/model'
type Player=ReturnType<typeof useMusic>
const time=(value:number)=>Math.floor(value/60)+':'+String(Math.floor(value%60)).padStart(2,'0')
export default function Jukebox({player}:{player:Player}){
 const [query,setQuery]=useState('')
 const tracks=player.tracks.filter(track=>track.title.toLowerCase().includes(query.toLowerCase()))
 return <><div className="panel-heading"><Icon name="jukebox"/><h2>唱片机</h2><span className="panel-aside">Java 1.21</span></div>
  <div className="music-filters"><input aria-label="查找音乐" placeholder="查找唱片…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  <div className="container-caption"><span>{player.loading?'正在读取唱片…':`${tracks.length} 首音乐`}</span><span>原始 OGG · 本地播放</span></div>
  <div className="container-scroll music-list" aria-label="原版音乐唱片">{tracks.map(track=><button key={track.id} className={'music-track pixel-button'+(player.track?.id===track.id?' active':'')} aria-label={'播放 '+track.title} aria-pressed={player.track?.id===track.id} onClick={()=>player.select(track)}><img alt="" src={resource('textures/item/music_disc_'+track.id.split('/').at(-1)+'.png')}/><span>{track.title}<small>音乐唱片</small></span>{player.track?.id===track.id&&<span>{player.playing?'播放中':'已选择'}</span>}</button>)}{!player.loading&&!tracks.length&&<p className="music-empty">没有找到唱片。</p>}</div>
  <div className="music-player"><div className="music-current" aria-live="polite">{player.track?.title||'请选择音乐'}<span>{time(player.position)} / {time(player.duration)}</span></div><input aria-label="音乐播放进度" type="range" min="0" max={player.duration||1} step="1" value={Math.min(player.position,player.duration||1)} disabled={!player.duration} onChange={e=>player.seek(Number(e.target.value))}/><div className="music-controls"><button className="pixel-button" aria-label="上一首" disabled={!player.track} onClick={()=>player.step(-1)}>上一首</button><button className="pixel-button" aria-label={player.playing?'暂停音乐':'播放音乐'} disabled={!player.track} onClick={player.toggle}>{player.playing?'暂停':'播放'}</button><button className="pixel-button" aria-label="下一首" disabled={!player.track} onClick={()=>player.step(1)}>下一首</button><label>音乐音量<input aria-label="音乐音量" type="range" min="0" max="1" step=".05" value={player.volume} onChange={e=>player.setVolume(Number(e.target.value))}/><span>{Math.round(player.volume*100)}%</span></label></div>{player.error&&<p className="save-error" role="alert">{player.error}</p>}</div>
 </>
}
