import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import * as THREE from 'three'

mkdirSync('.local',{recursive:true})
const directory=mkdtempSync(path.resolve('.local/lighting-test-'))
let createLightField,illuminate
try{const file=path.join(directory,'lighting.mjs');await build({entryPoints:['src/minecraft/lighting.ts'],outfile:file,bundle:true,platform:'node',format:'esm',packages:'external'});({createLightField,illuminate}=await import(pathToFileURL(file).href))}
finally{if(path.dirname(directory)===path.resolve('.local')&&path.basename(directory).startsWith('lighting-test-'))rmSync(directory,{recursive:true,force:true})}
const bounds={min:[-1,0,-1],max:[7,3,4]},source={position:[.5,1.5,.5],level:15},wall={min:[2,0,-1],max:[3,3,4]}
test('block light attenuates through air; a sealed wall prevents light leaking',()=>{
 const open=createLightField({bounds,solids:[],sources:[source]}),closed=createLightField({bounds,solids:[wall],sources:[source]})
 assert.equal(open.levels(source.position).block,15)
 assert.equal(open.levels([1.5,1.5,.5]).block,14)
 assert.equal(open.levels([4.5,1.5,.5]).block,11)
 assert.equal(closed.levels([4.5,1.5,.5]).block,0)
 assert.equal(closed.levels([2.5,1.5,.5]).solid,true)
})
test('skylight reaches a room through the window and stops at opaque walls',()=>{
 const solids=[{min:[2,0,-1],max:[3,1,4]},{min:[2,2,-1],max:[3,3,4]},{min:[2,1,-1],max:[3,2,0]},{min:[2,1,1],max:[3,2,4]}]
 const sky=p=>p[0]<0,window=createLightField({bounds,solids,sources:[],sky}),closed=createLightField({bounds,solids:[wall],sources:[],sky})
 assert.ok(window.levels([4.5,1.5,.5]).sky>=10)
 assert.equal(closed.levels([4.5,1.5,.5]).sky,0)
 assert.equal(window.levels([4.5,1.5,.5]).block,0)
})
test('a half-block desktop shades the space underneath while light can travel around it',()=>{
 const sources=[{position:[2.5,2.5,1.5],level:15}],desktop={min:[1,1.5,0],max:[4,2,3]},open=createLightField({bounds,solids:[],sources}),desk=createLightField({bounds,solids:[desktop],sources})
 const under=[2.5,1.25,1.5]
 assert.ok(desk.levels(under).block>0)
 assert.ok(desk.levels(under).block<open.levels(under).block)
 assert.equal(desk.levels([2.5,1.25,1.5]).solid,false)
 assert.equal(desk.levels([2.5,1.75,1.5]).solid,true)
})
test('world vertex baking respects entity transforms without changing shared GUI textures',()=>{
 const field=createLightField({bounds,solids:[wall],sources:[source]}),texture=new THREE.Texture(),material=new THREE.MeshBasicMaterial({map:texture,vertexColors:true})
 const make=()=>{const geometry=new THREE.BoxGeometry(.5,.5,.5);geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Array(geometry.getAttribute('position').count*3).fill(1),3));return new THREE.Mesh(geometry,material)}
 const near=make(),far=make(),originalUV=Array.from(far.geometry.getAttribute('uv').array)
 illuminate(near,field,new THREE.Matrix4().makeTranslation(.5,1.5,.5));illuminate(far,field,new THREE.Matrix4().makeTranslation(4.5,1.5,.5))
 const mean=mesh=>Array.from(mesh.geometry.getAttribute('color').array).reduce((a,b)=>a+b,0)/mesh.geometry.getAttribute('color').array.length
 assert.ok(mean(near)>mean(far)*3)
 assert.deepEqual(Array.from(far.geometry.getAttribute('uv').array),originalUV)
 assert.equal(material.map,texture);assert.equal(material.color.getHex(),0xffffff)
 near.geometry.dispose();far.geometry.dispose();material.dispose();texture.dispose()
})
