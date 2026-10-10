import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {build} from 'esbuild'

// Read the local native model; never store its asset definitions in source.
fs.mkdirSync('.local',{recursive:true})
const directory=fs.mkdtempSync(path.resolve('.local/lectern-audit-'))
try{
 const file=path.join(directory,'model.mjs')
 await build({entryPoints:['src/minecraft/model.ts'],outfile:file,bundle:true,platform:'node',format:'esm',packages:'external',define:{'import.meta.env.BASE_URL':'"/"'}})
 const {buildModel}=await import(pathToFileURL(file).href)
 const model=JSON.parse(fs.readFileSync('public/minecraft/models/block/lectern.json','utf8'))
 const textures=Object.fromEntries(Object.values(model.textures).map(name=>[name,new THREE.Texture()]))
 const mesh=buildModel(model,{models:{},textures}),group=new THREE.Group()
 // Actual Scene pose: zone (-1,0,0), corner compensation (1,0,1), Y=180°.
 group.position.set(0,0,1);group.rotation.y=Math.PI;group.add(mesh)
 const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3())
 const expectedHeight=.5+(8*Math.cos(Math.PI/8)+8*Math.sin(Math.PI/8))/16
 assert.deepEqual(model.elements[0].from,[0,0,0]);assert.deepEqual(model.elements[0].to,[16,2,16])
 assert.deepEqual(model.elements[1].from,[4,2,4]);assert.deepEqual(model.elements[1].to,[12,15,12])
 assert.equal(model.elements[2].rotation.angle,-22.5)
 assert.ok(Math.abs(size.x-1)<1e-6&&Math.abs(size.z-1)<1e-6&&Math.abs(size.y-expectedHeight)<1e-6)
 assert.deepEqual(mesh.scale.toArray(),[1,1,1])
 const result={reference:'Minecraft Java 1.21 local native lectern JSON',basePixels:[16,2,16],shaftPixels:[8,13,8],slopeDegrees:22.5,worldScale:mesh.scale.toArray(),worldSize:size.toArray(),worldMin:bounds.min.toArray(),worldMax:bounds.max.toArray(),extraScale:false}
 fs.mkdirSync('artifacts/screenshots',{recursive:true});fs.writeFileSync('artifacts/screenshots/lectern-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
 mesh.geometry.dispose();mesh.material.forEach(material=>material.dispose());Object.values(textures).forEach(texture=>texture.dispose())
}finally{if(path.dirname(directory)===path.resolve('.local')&&path.basename(directory).startsWith('lectern-audit-'))fs.rmSync(directory,{recursive:true,force:true})}
