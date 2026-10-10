import {Canvas,useFrame,useThree} from '@react-three/fiber'
import {useMemo,useState,useRef,useEffect,Component,type ReactNode} from 'react'
import * as THREE from 'three'
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {FACES,buildModel,chestParts,cube,loadAssets,openBook,type Assets,type Face,type Model} from './minecraft/model'
import {buildLayout,PALETTE,ROOM,LECTERN_VIEW,ZONES,LANTERNS,type Vec3 as Vec} from './minecraft/layout'
import {illuminate,studyLighting,type LightField} from './minecraft/lighting'
import RecordNotes from './minecraft/RecordNotes'
const LAYOUT=buildLayout()
// Stable renderer / camera options across music progress and other HUD renders.
const CAMERA_OPTIONS={position:ROOM.camera,fov:ROOM.fov,near:.05,far:64}
const GL_OPTIONS={antialias:false,powerPreference:'low-power' as const,toneMapping:THREE.NoToneMapping}
const DPR:[number,number]=[1,1.5]
type Props={onAction:(id:string)=>void;onHover:(id:string|null)=>void;paused:boolean;frozen?:boolean;reading?:boolean;strength:number;counts:number[];chestOpen?:boolean;recordPlaying?:boolean;onReady?:()=>void;onError?:(message:string)=>void}
function dispose(root:THREE.Object3D){root.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();const materials=Array.isArray(obj.material)?obj.material:[obj.material];materials.forEach(m=>m.dispose())}})}
function ModelObject({assets,model,position=[0,0,0],rotation=0,lighting,transform}:{assets:Assets;model:Model;position?:Vec;rotation?:number;lighting:LightField;transform?:THREE.Matrix4}){const mesh=useMemo(()=>{const mesh=buildModel(model,assets);mesh.position.set(...position);mesh.rotation.y=rotation;return illuminate(mesh,lighting,transform)},[assets,model,position.join(','),rotation,lighting,transform]);useEffect(()=>()=>dispose(mesh),[mesh]);return <primitive object={mesh}/>}
const MODELS=Object.fromEntries(Object.entries(PALETTE).map(([name,p])=>[name,cube(p.texture,{...('top' in p?{up:p.top}:{}),down:'bottom' in p?p.bottom:'top' in p?p.top:p.texture})]))
for(const axis of ['x','z']){const p=PALETTE.beam,model=cube(p.texture,axis==='x'?{east:p.top,west:p.top}:{north:p.top,south:p.top});for(const [face,definition] of Object.entries(model.elements[0].faces))if(axis==='x'?['up','down','north','south'].includes(face):['east','west'].includes(face))definition!.rotation=90;MODELS['beam:'+axis]=model}
function Camera({paused,frozen,reading=false,strength}:{paused:boolean;frozen?:boolean;reading?:boolean;strength:number}){
 const {camera,pointer,invalidate,events,gl}=useThree(),look=useRef(new THREE.Vector3(...ROOM.target)),homeLook=useRef(new THREE.Vector3(...ROOM.target)),ready=useRef(false),moving=useRef(true)
 useEffect(()=>{moving.current=true;invalidate()},[reading,invalidate])
 useFrame((_,dt)=>{
  if(frozen&&ready.current)return
  if(paused&&!reading&&!moving.current&&ready.current)return
  const view=reading?LECTERN_VIEW:ROOM,position=new THREE.Vector3(...view.camera),target=reading?new THREE.Vector3(...view.target):paused?homeLook.current:new THREE.Vector3(ROOM.target[0]+pointer.x*.45*strength,ROOM.target[1]+pointer.y*.23*strength,ROOM.target[2]),perspective=camera as THREE.PerspectiveCamera
  const distance=Math.max(look.current.distanceTo(target),camera.position.distanceTo(position),Math.abs(perspective.fov-view.fov)),settled=distance<=.0001,alpha=1-Math.exp(-Math.min(dt,.1)*7)
  if(settled){look.current.copy(target);camera.position.copy(position);perspective.fov=view.fov;moving.current=false}
  else{look.current.lerp(target,alpha);camera.position.lerp(position,alpha);perspective.fov=THREE.MathUtils.lerp(perspective.fov,view.fov,alpha)}
  if(!paused&&!reading)homeLook.current.copy(look.current)
  perspective.updateProjectionMatrix();camera.lookAt(look.current);camera.updateMatrixWorld();if(!paused)events.update?.();ready.current=true
  gl.domElement.dataset.cameraPointer=pointer.toArray().map(n=>n.toFixed(2)).join(',');gl.domElement.dataset.cameraSettled=String(settled);gl.domElement.dataset.cameraView=reading?'lectern':'room';gl.domElement.dataset.cameraPosition=camera.position.toArray().map(n=>n.toFixed(4)).join(',')
  if(!settled)invalidate()
 })
 useEffect(()=>{invalidate()},[paused,frozen,strength,invalidate]);return null
}
function Room({assets,lighting}:{assets:Assets;lighting:LightField}){
 const root=useMemo(()=>{
  const blocks=new Map<string,{position:Vec;model:Model;opaque:boolean}>(),key=(x:number,y:number,z:number)=>`${x},${y},${z}`
  for(const cell of LAYOUT.cells)blocks.set(cell.position.join(','),{position:cell.position,model:MODELS[cell.material==='beam'&&cell.axis!=='y'?'beam:'+cell.axis:cell.material],opaque:cell.material!=='glass'})
  const solid=(p:number[])=>blocks.get(key(p[0],p[1],p[2]))?.opaque??false
  const byMaterial=new Map<string,{geometries:THREE.BufferGeometry[];material:THREE.Material}>()
  for(const b of blocks.values()){
   const [x,y,z]=b.position
   const occluded=(face:Face)=>{const d=FACES[face].dir,neighbor=blocks.get(key(x+d[0],y+d[1],z+d[2]));return !!neighbor&&(neighbor.opaque||!b.opaque)}
   const ao=(face:Face,c:readonly number[])=>{const d=FACES[face].dir,axes=[0,1,2].filter(i=>d[i]===0),a=axes[0],v=axes[1],base=[x+d[0],y+d[1],z+d[2]];const one=[...base],two=[...base],corner=[...base];one[a]+=c[a]?1:-1;two[v]+=c[v]?1:-1;corner[a]+=c[a]?1:-1;corner[v]+=c[v]?1:-1;const hits=[one,two,corner].map(p=>solid(p)?1:0);return hits[0]&&hits[1]?.55:1-(hits[0]+hits[1]+hits[2])*.13}
   const mesh=illuminate(buildModel(b.model,assets,{position:b.position,isOccluded:occluded,ao}),lighting),materials=mesh.material as THREE.Material[]
   for(const group of mesh.geometry.groups){const mat=materials[group.materialIndex!],name=(mat as THREE.MeshBasicMaterial).map!.uuid;const geom=mesh.geometry.clone(),index=geom.getIndex()!;geom.setIndex(Array.from(index.array).slice(group.start,group.start+group.count));geom.clearGroups();if(!byMaterial.has(name))byMaterial.set(name,{geometries:[],material:mat});byMaterial.get(name)!.geometries.push(geom)}mesh.geometry.dispose()
  }
  const group=new THREE.Group();for(const {geometries,material} of byMaterial.values()){if(!geometries.length)continue;const geometry=mergeGeometries(geometries,false)!;geometries.forEach(g=>g.dispose());group.add(new THREE.Mesh(geometry,material))}return group
 },[assets,lighting]);useEffect(()=>()=>dispose(root),[root]);return <primitive object={root}/>
}
function Interactive({id,position,size,children,onAction,onHover}:{id:string;position:Vec;size:Vec;children:ReactNode;onAction:Props['onAction'];onHover:Props['onHover']}){
 const [hover,setHover]=useState(false),[cell,setCell]=useState<Vec>([0,0,0]),isShelf=id.startsWith('shelf:'),edges=useMemo(()=>{const box=new THREE.BoxGeometry(...(isShelf?[1,1,1]:size) as Vec),result=new THREE.EdgesGeometry(box);box.dispose();return result},[size.join(','),isShelf]);useEffect(()=>()=>edges.dispose(),[edges])
 const target=(point:THREE.Vector3)=>{if(!isShelf)return;const next=point.toArray().map((value,i)=>Math.max(Math.ceil(position[i]),Math.min(Math.floor(position[i]+size[i]-.001),Math.floor(value)))-position[i]+.5) as Vec;setCell(previous=>previous.every((v,i)=>v===next[i])?previous:next)}
 return <group position={position} onPointerOver={e=>{e.stopPropagation();target(e.point);setHover(true);onHover(id);document.body.style.cursor='pointer'}} onPointerMove={e=>{e.stopPropagation();target(e.point);setHover(true);onHover(id)}} onPointerOut={()=>{setHover(false);onHover(null);document.body.style.cursor=''}} onClick={e=>{e.stopPropagation();onAction(id)}}>{children}<mesh position={[size[0]/2,size[1]/2,size[2]/2]}><boxGeometry args={size}/><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false}/></mesh>{hover&&<lineSegments raycast={()=>{}} position={isShelf?cell:[size[0]/2,size[1]/2,size[2]/2]} geometry={edges}><lineBasicMaterial color="#111111"/></lineSegments>}</group>
}
const CHEST_TRANSFORM=new THREE.Matrix4().makeTranslation(...ZONES.find(z=>z.id==='chest')!.position)
const JUKEBOX_TRANSFORM=new THREE.Matrix4().makeTranslation(...ZONES.find(z=>z.id==='jukebox')!.position)
const LECTERN_TRANSFORM=new THREE.Matrix4().makeTranslation(...ZONES.find(z=>z.id==='lectern')!.position).multiply(new THREE.Matrix4().makeTranslation(1,0,1)).multiply(new THREE.Matrix4().makeRotationY(Math.PI))
const BOOK_TRANSFORM=LECTERN_TRANSFORM.clone().multiply(new THREE.Matrix4().makeTranslation(.5,1.0625,.5)).multiply(new THREE.Matrix4().makeRotationY(Math.PI/2)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI*3/8)).multiply(new THREE.Matrix4().makeTranslation(0,-.125,0))
function Chest({assets,open,frozen,lighting}:{assets:Assets;open:boolean;frozen?:boolean;lighting:LightField}){const parts=useMemo(()=>{const parts=chestParts(assets);illuminate(parts.root,lighting,CHEST_TRANSFORM);return parts},[assets,lighting]),progress=useRef(0);const {invalidate}=useThree();useFrame((_,dt)=>{if(frozen)return;const target=open?1:0;if(progress.current!==target){progress.current=THREE.MathUtils.clamp(progress.current+(open?1:-1)*Math.min(dt,.1)*2,0,1);parts.hinge.rotation.x=-Math.PI/2*(1-(1-progress.current)**3);invalidate()}});useEffect(()=>{invalidate()},[open,frozen,invalidate]);useEffect(()=>()=>dispose(parts.root),[parts]);return <primitive object={parts.root}/>}
function LecternBook({assets,lighting}:{assets:Assets;lighting:LightField}){const book=useMemo(()=>illuminate(openBook(assets),lighting,BOOK_TRANSFORM),[assets,lighting]);useEffect(()=>()=>dispose(book),[book]);return <group position={[.5,1.0625,.5]} rotation-y={Math.PI/2}><group rotation-z={Math.PI*3/8}><primitive object={book} position-y={-.125}/></group></group>}
function World(props:Props&{assets:Assets}){
 const {assets}=props,lighting=useMemo(()=>studyLighting(assets),[assets]),leaves=useMemo(()=>buildModel(cube('block/oak_leaves'),assets,{tint:0x72a443}),[assets]);useEffect(()=>()=>dispose(leaves),[leaves]);const {invalidate}=useThree();useEffect(()=>{invalidate();props.onReady?.()},[assets,invalidate])
 return <><Camera paused={props.paused} frozen={props.frozen} reading={props.reading} strength={props.strength}/><color attach="background" args={['#8db5fa']}/><Room assets={assets} lighting={lighting}/>
 {LAYOUT.decorations.map((item,i)=><ModelObject key={i} assets={assets} lighting={lighting} model={assets.models[item.model]} position={item.position} rotation={item.rotation}/>)}
 {ZONES.map((zone,i)=><Interactive key={i} {...props} {...zone}>{zone.id==='lectern'?<group position={[1,0,1]} rotation-y={Math.PI}><ModelObject assets={assets} lighting={lighting} transform={LECTERN_TRANSFORM} model={assets.models['block/lectern']}/><LecternBook assets={assets} lighting={lighting}/></group>:zone.id==='chest'?<Chest assets={assets} lighting={lighting} open={!!props.chestOpen} frozen={props.frozen}/>:zone.id==='jukebox'?<ModelObject assets={assets} lighting={lighting} transform={JUKEBOX_TRANSFORM} model={assets.models['block/jukebox']}/>:null}</Interactive>)}
 {LANTERNS.map((p,i)=><ModelObject key={i} assets={assets} lighting={lighting} position={p} model={assets.models['block/lantern_hanging']}/>)}
 <RecordNotes texture={assets.textures['particle/note']} playing={!!props.recordPlaying} frozen={!!props.frozen}/>
 {Array.from({length:9},(_,x)=>Array.from({length:6},(_,z)=><ModelObject key={`${x}${z}`} assets={assets} lighting={lighting} model={MODELS.grass} position={[x-4,-1,-6-z]}/>))}
 {[0,1,2].map(y=><ModelObject key={y} assets={assets} lighting={lighting} model={MODELS.beam} position={[-2,y,-10]}/>)}
 {[2,3].map(y=>[-1,0,1].map(x=>[-1,0,1].map(z=><primitive key={`${x}${y}${z}`} object={leaves.clone()} position={[-2+x,y,-10+z]}/>)))}
 </>
}
class SceneBoundary extends Component<{children:ReactNode;onError?:Props['onError']},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return{error:true}}componentDidCatch(error:Error){this.props.onError?.(error.message)}render(){return this.state.error?<div className="scene-fallback">3D 渲染不可用。物品栏仍可管理笔记。</div>:this.props.children}}
export default function Scene(props:Props){const [assets,setAssets]=useState<Assets|null>(null),[error,setError]=useState('');useEffect(()=>{let active=true;loadAssets().then(a=>{if(active)setAssets(a)}).catch(e=>{if(active){setError(e.message);props.onError?.(e.message)}});return()=>{active=false;document.body.style.cursor=''}},[]);return <SceneBoundary onError={props.onError}>{error?<div className="scene-fallback">书房资源加载失败：{error}</div>:<Canvas dpr={DPR} camera={CAMERA_OPTIONS} gl={GL_OPTIONS} frameloop="demand" onPointerMissed={()=>props.onHover(null)}>{assets&&<World {...props} assets={assets}/>}</Canvas>}</SceneBoundary>}
