import {useEffect,useRef,useState} from 'react'
import {resource} from './model'

export type MusicGroup='records'
export type Track={id:string;title:string;description?:string;groups:MusicGroup[];sha1:string;size:number}
type Settings={musicVolume?:number;musicTrack?:string}
export function useMusic(settings:Settings|undefined,paused:boolean,persist:(key:string,value:unknown)=>void){
 const [audio]=useState(()=>{const element=new Audio();element.preload='metadata';return element})
 const [tracks,setTracks]=useState<Track[]>([]),[id,setId]=useState(''),[playing,setPlaying]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true),[started,setStarted]=useState(false),[announcement,setAnnouncement]=useState<{id:string;serial:number}|null>(null)
 const pendingAnnouncement=useRef(false)
 const save=useRef(persist),initialized=useRef(false),ended=useRef<()=>void>(()=>{});save.current=persist
 useEffect(()=>{let active=true;fetch(resource('sounds/music-manifest.json')).then(async response=>{if(!response.ok)throw new Error('本地音乐资源未安装');const manifest=await response.json();if(manifest.version!=='1.21'||!Array.isArray(manifest.tracks)||!manifest.tracks.length)throw new Error('音乐清单无效');if(active)setTracks(manifest.tracks)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[])
 useEffect(()=>{if(initialized.current||!settings||!tracks.length)return;initialized.current=true;setId(tracks.some(t=>t.id===settings.musicTrack)?settings.musicTrack!:tracks.find(t=>t.id==='records/cat')?.id||tracks[0].id)},[settings,tracks])
 useEffect(()=>{audio.volume=settings?.musicVolume??.5},[audio,settings?.musicVolume])
 useEffect(()=>{const time=()=>setPosition(audio.currentTime),length=()=>setDuration(Number.isFinite(audio.duration)?audio.duration:0),fail=()=>{setPlaying(false);setError('音乐无法播放，请检查本地资源包。')},next=()=>ended.current(),began=()=>{setStarted(true);if(pendingAnnouncement.current){pendingAnnouncement.current=false;setAnnouncement(previous=>({id:audio.dataset.track!,serial:(previous?.serial??0)+1}))}};audio.addEventListener('playing',began);audio.addEventListener('timeupdate',time);audio.addEventListener('loadedmetadata',length);audio.addEventListener('durationchange',length);audio.addEventListener('ended',next);audio.addEventListener('error',fail);return()=>{audio.pause();audio.removeEventListener('playing',began);audio.removeEventListener('timeupdate',time);audio.removeEventListener('loadedmetadata',length);audio.removeEventListener('durationchange',length);audio.removeEventListener('ended',next);audio.removeEventListener('error',fail);audio.removeAttribute('src');audio.load()}},[audio])
 useEffect(()=>{if(!id)return;audio.pause();setStarted(false);setPosition(0);setDuration(0);audio.dataset.track=id;audio.src=resource('sounds/'+id+'.ogg');audio.load()},[audio,id])
 useEffect(()=>{let active=true;if(playing&&!paused&&id)void audio.play().catch(()=>{if(active){setPlaying(false);setError('播放失败，请再次点击播放。')}});else audio.pause();return()=>{active=false;audio.pause()}},[audio,id,playing,paused])
 const select=(track:Track)=>{setError('');pendingAnnouncement.current=true;if(track.id===id&&playing&&!paused){pendingAnnouncement.current=false;setAnnouncement(previous=>({id,serial:(previous?.serial??0)+1}))}setId(track.id);setPlaying(true);save.current('musicTrack',track.id)}
 const step=(direction:number)=>{if(!tracks.length)return;select(tracks[(Math.max(0,tracks.findIndex(t=>t.id===id))+direction+tracks.length)%tracks.length])}
 ended.current=()=>step(1)
 return {tracks,track:tracks.find(t=>t.id===id),playing,started,announcement,position,duration,error,loading,select,step,toggle:()=>{if(id){setError('');pendingAnnouncement.current=!playing;setPlaying(!playing)}},seek:(seconds:number)=>{if(Number.isFinite(audio.duration)){audio.currentTime=Math.min(audio.duration,Math.max(0,seconds));setPosition(audio.currentTime)}},volume:settings?.musicVolume??.5,setVolume:(value:number)=>{audio.volume=value;save.current('musicVolume',value)}}
}
