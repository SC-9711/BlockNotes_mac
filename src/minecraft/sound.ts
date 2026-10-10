import {resource} from './model'

export type SoundEvent='ui.button.click'|'block.chest.open'|'block.chest.close'|'item.book.page_turn'|'item.book.put'|'block.chiseled_bookshelf.pickup'|'block.chiseled_bookshelf.insert'
type Sample={name:string;volume?:number;pitch?:number;weight?:number}
type Manifest={version:string;events:Record<SoundEvent,{sounds:(string|Sample)[]}>}
let context:AudioContext|undefined,manifest:Manifest|undefined,loading:Promise<void>|undefined,master=1
const buffers=new Map<string,AudioBuffer>()
const volume:Record<SoundEvent,number>={'ui.button.click':.25,'block.chest.open':.5,'block.chest.close':.5,'item.book.page_turn':.25,'item.book.put':1,'block.chiseled_bookshelf.pickup':1,'block.chiseled_bookshelf.insert':1}

function audio(){return context??=new AudioContext({latencyHint:'interactive'})}
export function setSoundVolume(value:number){master=Math.max(0,Math.min(1,value))}
export function prepareSounds(){
 if(loading)return loading
 loading=(async()=>{
  const response=await fetch(resource('sounds/manifest.json'));if(!response.ok)throw new Error('音效资源缺失')
  manifest=await response.json()
  const names=new Set(Object.values(manifest!.events).flatMap(e=>e.sounds.map(s=>typeof s==='string'?s:s.name)))
  await Promise.all([...names].map(async name=>{const file=await fetch(resource('sounds/'+name+'.ogg'));if(!file.ok)throw new Error('音效资源缺失：'+name);buffers.set(name,await audio().decodeAudioData(await file.arrayBuffer()))}))
 })().catch(error=>{loading=undefined;console.warn('原版音效未加载，笔记功能保持可用。',error)})
 return loading
}
export function installSoundActivation(){
 const activate=()=>{try{void audio().resume().catch(()=>{})}catch{/* Audio availability never blocks a note operation. */}}
 document.addEventListener('pointerdown',activate,{capture:true});document.addEventListener('keydown',activate,{capture:true})
 void prepareSounds()
 return()=>{document.removeEventListener('pointerdown',activate,true);document.removeEventListener('keydown',activate,true)}
}
export function playSound(event:SoundEvent){
 if(!master)return
 // Decode once and play the original OGG sample. No synthesized replacements.
 const started=performance.now()
 void prepareSounds().then(()=>{
  if(!manifest||performance.now()-started>350||!master||audio().state!=='running')return
  const samples=manifest.events[event].sounds.map(s=>typeof s==='string'?{name:s}:s)
  let pick=Math.random()*samples.reduce((sum,s)=>sum+(s.weight??1),0),sample=samples.at(-1)!
  for(const candidate of samples){pick-=candidate.weight??1;if(pick<0){sample=candidate;break}}
  const buffer=buffers.get(sample.name);if(!buffer)return
  const source=audio().createBufferSource(),gain=audio().createGain();source.buffer=buffer
  source.playbackRate.value=(sample.pitch??1)*(event.startsWith('block.chest.')?.9+Math.random()*.1:1)
  source.loop=false;source.connect(gain);gain.gain.value=master*Math.min(1,volume[event]*(sample.volume??1));gain.connect(audio().destination)
  source.onended=()=>{source.disconnect();gain.disconnect()};source.start()
 }).catch(()=>{})
}
