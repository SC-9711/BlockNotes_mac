import {useEffect,useMemo,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import * as THREE from 'three'
import {ZONES} from './layout'

// Java 1.21 NoteParticle: native sprite, sine-based note color, six ticks,
// upward motion and 0.66 friction. One small particle; no glow or confetti.
export default function RecordNotes({texture,playing,frozen}:{texture:THREE.Texture;playing:boolean;frozen:boolean}){
 const sprite=useMemo(()=>{const material=new THREE.SpriteMaterial({map:texture,transparent:true,alphaTest:.1,depthWrite:false,toneMapped:false});const sprite=new THREE.Sprite(material);sprite.visible=false;sprite.raycast=()=>{};return sprite},[texture])
 const {invalidate,gl}=useThree(),age=useRef(1),untilNext=useRef(0),velocity=useRef(.2)
 useEffect(()=>()=>sprite.material.dispose(),[sprite])
 useEffect(()=>{if(!playing){sprite.visible=false;gl.domElement.dataset.noteVisible='false';untilNext.current=0;age.current=1;invalidate()}if(!playing||frozen)return;invalidate();const timer=setInterval(invalidate,50);return()=>clearInterval(timer)},[playing,frozen,invalidate,sprite,gl])
 useFrame((_,dt)=>{
  if(!playing||frozen)return
  const ticks=Math.min(dt,.1)*20;untilNext.current-=ticks
  if(untilNext.current<=0){untilNext.current=20;age.current=0;velocity.current=.2;const note=Math.floor(Math.random()*4)/24,p=ZONES.find(z=>z.id==='jukebox')!.position;sprite.position.set(p[0]+.5,p[1]+1.7,p[2]+.5);sprite.scale.setScalar(.375);sprite.material.color.setRGB(...[0,1/3,2/3].map(offset=>Math.max(0,Math.sin((note+offset)*Math.PI*2)*.65+.35)) as [number,number,number]);sprite.visible=true}
  age.current+=ticks;sprite.position.y+=velocity.current*ticks;velocity.current*=.66**ticks;if(age.current>=6)sprite.visible=false;gl.domElement.dataset.noteVisible=String(sprite.visible)
 })
 return <primitive object={sprite}/>
}
