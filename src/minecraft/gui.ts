import * as THREE from 'three'
import {buildModel,chestParts,loadAssets,type Assets} from './model'
export type BlockItem='chest'|'shelf'|'lectern'|'jukebox'
const names={chest:'item/chest',shelf:'item/bookshelf',lectern:'item/lectern',jukebox:'item/jukebox'}
const rendered=new Map<string,Promise<string>>()

export function blockItem(assets:Assets,name:BlockItem){
 const definition=assets.models[names[name]],display=definition.display?.gui
 if(!display)throw new Error('缺少物品 GUI 模型 '+names[name])
 const mesh=name==='chest'?chestParts(assets).root:buildModel(definition,assets)
 mesh.position.set(-.5,-.5,-.5)
 const pivot=new THREE.Group();pivot.add(mesh)
 pivot.rotation.set(...(display.rotation||[0,0,0]).map(THREE.MathUtils.degToRad) as [number,number,number])
 pivot.scale.set(...(display.scale||[1,1,1]) as [number,number,number])
 pivot.position.set(...(display.translation||[0,0,0]).map(n=>n/16) as [number,number,number])
 return pivot
}
// Java 1.21 GUI uses two diffuse lights and 0.4 ambient, rather than the
// room's baked directional shades. Directions include the GUI lighting pose.
const lightPose=new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(62))
 .multiply(new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(185.5)))
 .multiply(new THREE.Matrix4().makeRotationY(-Math.PI/8))
 .multiply(new THREE.Matrix4().makeRotationX(Math.PI*3/4))
const lights=[new THREE.Vector3(.2,1,-.7),new THREE.Vector3(-.2,1,.7)].map(v=>v.normalize().transformDirection(lightPose))
function lightItem(root:THREE.Group){
 root.updateMatrixWorld(true)
 root.traverse(obj=>{
  if(!(obj instanceof THREE.Mesh))return
  const normals=obj.geometry.getAttribute('normal'),colors=obj.geometry.getAttribute('color'),matrix=new THREE.Matrix3().getNormalMatrix(obj.matrixWorld)
  for(let i=0;i<normals.count;i++){
   const normal=new THREE.Vector3().fromBufferAttribute(normals,i).applyNormalMatrix(matrix)
   const light=Math.min(1,.4+.6*lights.reduce((sum,l)=>sum+Math.max(0,l.dot(normal)),0))
   colors.setXYZ(i,light,light,light)
  }
  colors.needsUpdate=true
  for(const material of Array.isArray(obj.material)?obj.material:[obj.material]){
   const m=material as THREE.MeshBasicMaterial
   // GUI textures in vanilla are multiplied in their original color space.
   // Clone to avoid changing textures shared with the room.
   if(m.map){m.map=m.map.clone();m.map.colorSpace=THREE.NoColorSpace;m.map.needsUpdate=true}
  }
 })
}
export function renderBlockItem(name:BlockItem,size:number){
 const key=`${name}:${size}`;if(rendered.has(key))return rendered.get(key)!
 const result=loadAssets().then(assets=>{
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false})
  const scene=new THREE.Scene(),model=blockItem(assets,name)
  try{
   renderer.setPixelRatio(1);renderer.setSize(size,size);renderer.setClearColor(0,0)
   renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping
   scene.add(model);lightItem(model)
   const camera=new THREE.OrthographicCamera(-.5,.5,.5,-.5,.01,10);camera.position.set(0,0,5)
   renderer.render(scene,camera)
   return renderer.domElement.toDataURL()
  }finally{
   renderer.dispose();renderer.forceContextLoss()
   model.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();for(const m of Array.isArray(obj.material)?obj.material:[obj.material]){(m as THREE.MeshBasicMaterial).map?.dispose();m.dispose()}}})
  }
 }).catch(error=>{rendered.delete(key);throw error})
 rendered.set(key,result);return result
}
