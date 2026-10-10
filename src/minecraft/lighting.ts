import * as THREE from 'three'
import {buildLayout,LANTERNS,ZONES,type Vec3} from './layout'
import type {Assets,Model} from './model'

export type Box={min:Vec3;max:Vec3}
type Source={position:Vec3;level:number}
// Four samples per block retain slab/beam occlusion. Light travels through air
// (glass passes light), losing one level per block, rather than through walls.
export function createLightField({bounds,solids,sources,sky}:{bounds:Box;solids:Box[];sources:Source[];sky?:(point:Vec3)=>boolean}){
 const scale=4,size=bounds.max.map((v,i)=>Math.ceil((v-bounds.min[i])*scale)),[sx,sy,sz]=size,total=sx*sy*sz
 const opaque=new Uint8Array(total),block=new Uint8Array(total),day=new Uint8Array(total)
 const index=(x:number,y:number,z:number)=>x+sx*(y+sy*z)
 const coordinates=(p:Vec3)=>p.map((v,i)=>Math.floor((v-bounds.min[i])*scale))
 const inside=([x,y,z]:number[])=>x>=0&&y>=0&&z>=0&&x<sx&&y<sy&&z<sz
 const point=(x:number,y:number,z:number)=>[x,y,z].map((v,i)=>bounds.min[i]+(v+.5)/scale) as Vec3
 for(const box of solids){const from=coordinates(box.min),to=box.max.map((v,i)=>Math.ceil((v-bounds.min[i])*scale));for(let z=Math.max(0,from[2]);z<Math.min(sz,to[2]);z++)for(let y=Math.max(0,from[1]);y<Math.min(sy,to[1]);y++)for(let x=Math.max(0,from[0]);x<Math.min(sx,to[0]);x++)opaque[index(x,y,z)]=1}
 const propagate=(values:Uint8Array,seeds:number[])=>{
  // A cell can be improved by a brighter path; an append-only queue handles
  // those revisits without losing work or imposing a fixed queue capacity.
  const queue=seeds;for(let head=0;head<queue.length;head++){
   const i=queue[head],value=values[i]-1;if(value<=0)continue
   const x=i%sx,y=Math.floor(i/sx)%sy,z=Math.floor(i/(sx*sy))
   for(const [next,valid] of [[i-1,x>0],[i+1,x+1<sx],[i-sx,y>0],[i+sx,y+1<sy],[i-sx*sy,z>0],[i+sx*sy,z+1<sz]] as [number,boolean][])if(valid&&!opaque[next]&&values[next]<value){values[next]=value;queue.push(next)}
  }
 }
 const seeds:number[]=[]
 for(const source of sources){const c=coordinates(source.position);if(inside(c)){const i=index(c[0],c[1],c[2]);if(!opaque[i]){block[i]=Math.round(Math.max(0,Math.min(15,source.level))*scale);seeds.push(i)}}}
 propagate(block,seeds)
 const skySeeds:number[]=[]
 if(sky)for(let z=0;z<sz;z++)for(let y=0;y<sy;y++)for(let x=0;x<sx;x++){const i=index(x,y,z);if(!opaque[i]&&sky(point(x,y,z))){day[i]=15*scale;skySeeds.push(i)}}
 propagate(day,skySeeds)
 const levels=(p:Vec3)=>{const c=coordinates(p);if(!inside(c))return{block:0,sky:p[2]<bounds.min[2]?15:0,solid:false};const i=index(c[0],c[1],c[2]);return{block:block[i]/scale,sky:day[i]/scale,solid:!!opaque[i]}}
 const color=(p:Vec3)=>{
  const light=levels(p),strength=(level:number)=>{const f=Math.round(level)/15,base=f/(4-3*f);return .12+.88*(base*.35+(1-(1-base)**4)*.65)}
  const b=strength(light.block),s=strength(light.sky)
  // Modest vanilla-style warm block light / neutral daylight. Directional
  // face shading and corner AO are applied independently by the geometry.
  return new THREE.Color().setRGB(Math.max(b,s*.96),Math.max(b*.94,s*.98),Math.max(b*.83,s))
 }
 return {levels,color}
}
export type LightField=ReturnType<typeof createLightField>

function modelBoxes(model:Model,position:Vec3,rotation=0):Box[]{
 const transform=new THREE.Matrix4().makeTranslation(...position).multiply(new THREE.Matrix4().makeRotationY(rotation))
 return model.elements.map(el=>{const box=new THREE.Box3();for(const x of [el.from[0],el.to[0]])for(const y of [el.from[1],el.to[1]])for(const z of [el.from[2],el.to[2]]){const v=new THREE.Vector3(x,y,z);if(el.rotation){const r=el.rotation,origin=new THREE.Vector3(...r.origin as Vec3),axis=new THREE.Vector3(r.axis==='x'?1:0,r.axis==='y'?1:0,r.axis==='z'?1:0);v.sub(origin).applyAxisAngle(axis,THREE.MathUtils.degToRad(r.angle)).add(origin)}box.expandByPoint(v.divideScalar(16).applyMatrix4(transform))}return {min:box.min.toArray() as Vec3,max:box.max.toArray() as Vec3}})
}
export function studyLighting(assets:Assets):LightField{
 const layout=buildLayout(),solids:Box[]=layout.cells.filter(c=>c.material!=='glass').map(c=>({min:c.position,max:c.position.map(v=>v+1) as Vec3}))
 for(const item of layout.decorations)if(/slab|stairs|trapdoor|fence_post/.test(item.model))solids.push(...modelBoxes(assets.models[item.model],item.position,item.rotation))
 for(const zone of ZONES){if(zone.id==='jukebox')solids.push({min:zone.position,max:zone.position.map(v=>v+1) as Vec3});if(zone.id==='chest')solids.push({min:[zone.position[0]+.0625,zone.position[1],zone.position[2]+.0625],max:[zone.position[0]+.9375,zone.position[1]+.875,zone.position[2]+.9375]})}
 // The camera-facing wall is omitted from visible geometry, but closes the
 // room for lighting so that cutaway space cannot act as a second skylight.
 solids.push({min:[-7,-2,6],max:[8,8,7]})
 const sources=[...LANTERNS.map(p=>({position:[p[0]+.5,p[1]+.35,p[2]+.5] as Vec3,level:15})),{position:[2.5,2.35,-1.5] as Vec3,level:15}]
 return createLightField({bounds:{min:[-7,-2,-7],max:[8,8,7]},solids,sources,sky:p=>p[2]<-5&&p[1]>=0})
}

// Bake shared block lighting into vertex colors once, including native entity
// meshes. Maps/materials remain unmodified, so inventory icons stay full-bright.
export function illuminate<T extends THREE.Object3D>(root:T,field:LightField,transform=new THREE.Matrix4()):T{
 root.updateMatrixWorld(true)
 root.traverse(obj=>{if(!(obj instanceof THREE.Mesh))return;const geometry=obj.geometry,positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),colors=geometry.getAttribute('color');if(!colors)return
  const matrix=new THREE.Matrix4().multiplyMatrices(transform,obj.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix)
  for(let i=0;i<positions.count;i++){
   const normal=new THREE.Vector3().fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize(),position=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(matrix).addScaledVector(normal,.14)
   const tangent=new THREE.Vector3().crossVectors(normal,Math.abs(normal.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize(),axes=[tangent,new THREE.Vector3().crossVectors(normal,tangent).normalize()]
   const sum=new THREE.Color(0,0,0);let count=0,blocked=0
   for(const a of [-1,1])for(const b of [-1,1]){const sample=position.clone().addScaledVector(axes[0],a*.13).addScaledVector(axes[1],b*.13).toArray() as Vec3;if(field.levels(sample).solid){blocked++;continue}sum.add(field.color(sample));count++}
   if(count)sum.multiplyScalar((1-blocked*.055)/count);else sum.copy(field.color(position.toArray() as Vec3))
   colors.setXYZ(i,colors.getX(i)*sum.r,colors.getY(i)*sum.g,colors.getZ(i)*sum.b)
  }colors.needsUpdate=true
 })
 return root
}
