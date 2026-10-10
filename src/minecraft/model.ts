import * as THREE from 'three'
import {requiredModels,requiredTextures} from './layout'
// Face corner order adapted from PrismarineJS/prismarine-viewer (MIT).
// Attribution and upstream commit are retained in THIRD_PARTY_NOTICES.md.
export const FACES = {
 up:{dir:[0,1,0],corners:[[0,1,1,0,1],[1,1,1,1,1],[0,1,0,0,0],[1,1,0,1,0]]},
 down:{dir:[0,-1,0],corners:[[1,0,1,0,1],[0,0,1,1,1],[1,0,0,0,0],[0,0,0,1,0]]},
 east:{dir:[1,0,0],corners:[[1,1,1,0,0],[1,0,1,0,1],[1,1,0,1,0],[1,0,0,1,1]]},
 west:{dir:[-1,0,0],corners:[[0,1,0,0,0],[0,0,0,0,1],[0,1,1,1,0],[0,0,1,1,1]]},
 north:{dir:[0,0,-1],corners:[[1,0,0,0,1],[0,0,0,1,1],[1,1,0,0,0],[0,1,0,1,0]]},
 south:{dir:[0,0,1],corners:[[0,0,1,0,1],[1,0,1,1,1],[0,1,1,0,0],[1,1,1,1,0]]}
} as const
export type Face=keyof typeof FACES
export type Element={from:number[];to:number[];shade?:boolean;rotation?:{origin:number[];axis:'x'|'y'|'z';angle:number;rescale?:boolean};faces:Partial<Record<Face,{uv?:number[];texture:string;rotation?:number}>>}
export type Model={textures:Record<string,string>;elements:Element[];display?:Record<string,{rotation?:number[];translation?:number[];scale?:number[]}>}
export type Assets={textures:Record<string,THREE.Texture>;models:Record<string,Model>}
export const assetUrl=(p:string)=>new URL('../../minecraft/'+p,import.meta.url).href
// Vite cannot statically rewrite a runtime resource path. All asset fetches remain local.
export const resource=(p:string)=>`${import.meta.env.BASE_URL}minecraft/${p}`
let loading:Promise<Assets>|undefined
export function loadAssets(){
 if(loading)return loading
 loading=(async()=>{
  const loader=new THREE.TextureLoader();const textures:Assets['textures']={}
  const models:Record<string,Model>={}
  async function model(name:string):Promise<Model>{if(models[name])return models[name];const response=await fetch(resource('models/'+name+'.json'));if(!response.ok)throw new Error('缺少模型 '+name);const own=await response.json();const parent=own.parent&&!own.parent.includes('builtin/')?await model(own.parent.replace('minecraft:','')):{textures:{},elements:[]};const result={...parent,...own,textures:{...parent.textures,...own.textures},display:{...parent.display,...own.display}};models[name]=result;return result}
  await Promise.all(requiredModels.map(model))
  const names=new Set(requiredTextures)
  for(const definition of Object.values(models))for(const element of definition.elements)for(const face of Object.values(element.faces))names.add(resolveTexture(face!.texture,definition))
  await Promise.all([...names].map(async name=>{const texture=await loader.loadAsync(resource('textures/'+name+'.png'));texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;if(name==='block/lantern'){const fraction=texture.image.width/texture.image.height;texture.repeat.y=fraction;texture.offset.y=1-fraction}textures[name]=texture}))
  return {textures,models}
 })().catch(e=>{loading=undefined;throw e})
 return loading
}
export function cube(texture:string,overrides:Partial<Record<Face,string>>={}):Model {return {textures:{},elements:[{from:[0,0,0],to:[16,16,16],faces:Object.fromEntries(Object.keys(FACES).map(f=>[f,{texture:overrides[f as Face]||texture,uv:[0,0,16,16]}]))}]}}
function resolveTexture(name:string,model:Model):string{let value=name;for(let i=0;i<12&&value.startsWith('#');i++)value=model.textures[value.slice(1)]||'block/oak_planks';return value.replace('minecraft:','')}
export function buildModel(model:Model,assets:Assets,{light=1,tint=0xffffff,position=[0,0,0],isOccluded,ao}: {light?:number;tint?:number;position?:number[];isOccluded?:(face:Face)=>boolean;ao?:(face:Face,corner:readonly number[])=>number}={}){
 const positions:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[],groups:{start:number;count:number;materialIndex:number}[]=[],materialNames:string[]=[]
 for(const el of model.elements)for(const name of Object.keys(el.faces) as Face[]){
  if(isOccluded?.(name))continue
  const face=el.faces[name]!,definition=FACES[name],uv=face.uv||[0,0,16,16],tex=resolveTexture(face.texture,model)
  const map=assets.textures[tex];if(!map)throw new Error('缺少材质 '+tex)
  let materialIndex=materialNames.indexOf(tex);if(materialIndex<0){materialIndex=materialNames.length;materialNames.push(tex)}
  const start=positions.length/3,shade=el.shade===false?1:name==='up'?1:name==='down'?.5:['east','west'].includes(name)?.6:.8
  const rot=el.rotation,axis=rot?new THREE.Vector3(rot.axis==='x'?1:0,rot.axis==='y'?1:0,rot.axis==='z'?1:0):null
  const uvAngle=THREE.MathUtils.degToRad(-(face.rotation||0)),cos=Math.cos(uvAngle),sin=Math.sin(uvAngle)
  for(const corner of definition.corners){
   const v=new THREE.Vector3(...corner.slice(0,3).map((value,i)=>value?el.to[i]:el.from[i]) as [number,number,number])
   if(rot&&axis){const origin=new THREE.Vector3(...rot.origin as [number,number,number]);v.sub(origin).applyAxisAngle(axis,THREE.MathUtils.degToRad(rot.angle)).add(origin)}
   positions.push(v.x/16+position[0],v.y/16+position[1],v.z/16+position[2])
   const u=(corner[3]-.5)*cos-(corner[4]-.5)*sin+.5,w=(corner[3]-.5)*sin+(corner[4]-.5)*cos+.5
   // Java UVs start at the top-left; Three.js texture UVs start bottom-left.
   uvs.push((uv[0]+u*(uv[2]-uv[0]))/16,1-(uv[1]+w*(uv[3]-uv[1]))/16)
   const color=new THREE.Color(tint).multiplyScalar(shade*light*(ao?.(name,corner)??1));colors.push(color.r,color.g,color.b)
  }
  groups.push({start:indices.length,count:6,materialIndex});indices.push(start,start+1,start+2,start+2,start+1,start+3)
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();groups.forEach(g=>geometry.addGroup(g.start,g.count,g.materialIndex))
 // Native models provide opposite faces explicitly, including zero-thickness
 // ladders / plants. Rendering each face from both sides duplicates coplanar
 // quads and makes the different UVs / lighting fight in the depth buffer.
 const materials=materialNames.map(name=>new THREE.MeshBasicMaterial({map:assets.textures[name],vertexColors:true,transparent:name.includes('glass'),alphaTest:name.includes('glass')?.05:.5,side:THREE.FrontSide}))
 const mesh=new THREE.Mesh(geometry,materials);return mesh
}
export function entityCuboid(from:number[],to:number[],offset:number[],dimensions:number[],texture:string):Model{
 const [u,v]=offset,[w,h,d]=dimensions,[tw,th]=texture==='entity/enchanting_table_book'?[64,32]:[64,64]
 const uv=(a:number,b:number,c:number,e:number)=>[a/tw*16,b/th*16,c/tw*16,e/th*16]
 // Entity atlases use ModelPart.Cube's net, not block JSON's UV orientation.
 // Checked against Java 1.21: the second top strip is UP, first is DOWN.
 // Reverse the side coordinates to express entity vertex UVs in FACES order.
 return {textures:{},elements:[{from,to,faces:{west:{texture,uv:uv(u+d,v+d+h,u,v+d)},north:{texture,uv:uv(u+d+w,v+d+h,u+d,v+d)},east:{texture,uv:uv(u+d+w+d,v+d+h,u+d+w,v+d)},south:{texture,uv:uv(u+d+w+d+w,v+d+h,u+d+w+d,v+d)},up:{texture,uv:uv(u+d+w,v+d,u+d+w+w,v)},down:{texture,uv:uv(u+d+w,v+d,u+d,v)}}}]}
}
export function chestParts(assets:Assets){
 const texture='entity/chest/normal'
 const base=buildModel(entityCuboid([1,0,1],[15,10,15],[0,19],[14,10,14],texture),assets)
 const lid=buildModel(entityCuboid([1,0,0],[15,5,14],[0,0],[14,5,14],texture),assets)
 const latch=buildModel(entityCuboid([7,-2,14],[9,2,15],[0,0],[2,4,1],texture),assets)
 const hinge=new THREE.Group();hinge.position.set(0,9/16,1/16);hinge.add(lid,latch)
 const root=new THREE.Group();root.add(base,hinge);return {root,hinge}
}
export function openBook(assets:Assets){
 const root=new THREE.Group(),texture='entity/enchanting_table_book'
 // Dimensions and the stationary lectern pose from 1.21 BookModel /
 // LecternRenderer. No enchanting-table bobbing or unrelated game logic.
 const angle=1.5,z=Math.sin(angle)/16
 const part=(name:string,from:number[],dimensions:number[],offset:number[],rotation:number,position:number[])=>{
  const mesh=buildModel(entityCuboid(from,from.map((n,i)=>n+dimensions[i]),offset,dimensions,texture),assets)
  const group=new THREE.Group();group.name=name;group.rotation.y=rotation;group.position.set(...position as [number,number,number]);group.add(mesh);root.add(group)
 }
 part('left_lid',[-6,-5,-.005],[6,10,.005],[0,0],Math.PI+angle,[0,0,-1/16])
 part('right_lid',[0,-5,-.005],[6,10,.005],[16,0],-angle,[0,0,1/16])
 part('seam',[-1,-5,0],[2,10,.005],[12,0],Math.PI/2,[0,0,0])
 part('left_pages',[0,-4,-.99],[5,8,1],[0,10],angle,[0,0,z])
 part('right_pages',[0,-4,-.01],[5,8,1],[12,10],-angle,[0,0,z])
 part('flip_page1',[0,-4,0],[5,8,.005],[24,10],1.2,[0,0,z])
 part('flip_page2',[0,-4,0],[5,8,.005],[24,10],-1.2,[0,0,z])
 return root
}
