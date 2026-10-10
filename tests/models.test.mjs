import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import * as THREE from 'three'

// Compare actual render geometry against independently checked Java 1.21
// ChestRenderer / ModelPart atlas coordinates; no game assets are required.
mkdirSync('.local',{recursive:true})
const directory=mkdtempSync(path.resolve('.local/model-test-'))
let models,gui,layout
try{
 const file=path.join(directory,'model.mjs')
 await build({entryPoints:['src/minecraft/model.ts'],outfile:file,bundle:true,platform:'node',format:'esm',packages:'external',define:{'import.meta.env.BASE_URL':'"/"'}})
 models=await import(pathToFileURL(file).href)
 const guiFile=path.join(directory,'gui.mjs')
 await build({entryPoints:['src/minecraft/gui.ts'],outfile:guiFile,bundle:true,platform:'node',format:'esm',packages:'external',define:{'import.meta.env.BASE_URL':'"/"'}})
 gui=await import(pathToFileURL(guiFile).href)
 const layoutFile=path.join(directory,'layout.mjs')
 await build({entryPoints:['src/minecraft/layout.ts'],outfile:layoutFile,bundle:true,platform:'node',format:'esm'})
 layout=await import(pathToFileURL(layoutFile).href)
}finally{
 if(path.dirname(directory)===path.resolve('.local')&&path.basename(directory).startsWith('model-test-'))rmSync(directory,{recursive:true,force:true})
}
const assets={models:{},textures:{'entity/chest/normal':new THREE.Texture(),'entity/enchanting_table_book':new THREE.Texture()}}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`)
function faceUV(mesh,index){const a=mesh.geometry.getAttribute('uv');return Array.from({length:4},(_,i)=>[a.getX(index*4+i),a.getY(index*4+i)])}

test('1.21 箱盖外侧顶面使用 (28,0)-(42,14)，朝向与实体顶面一致',()=>{
 const {hinge}=models.chestParts(assets),lid=hinge.children[0]
 const expected=[[28/64,1],[42/64,1],[28/64,50/64],[42/64,50/64]]
 faceUV(lid,4).forEach((uv,i)=>uv.forEach((value,j)=>close(value,expected[i][j])))
 // Front is +Z. Bottom edge maps to y=14, top edge to y=19 on the lid atlas.
 const front=[[56/64,50/64],[42/64,50/64],[56/64,45/64],[42/64,45/64]]
 faceUV(lid,3).forEach((uv,i)=>uv.forEach((value,j)=>close(value,front[i][j])))
})
test('1.21 箱子转轴、盖高、锁扣和闭合高度保持像素比例',()=>{
 const {root,hinge}=models.chestParts(assets)
 close(hinge.position.y,9/16);close(hinge.position.z,1/16)
 const latch=new THREE.Box3().setFromObject(hinge.children[1]);close(latch.min.y,-2/16);close(latch.max.y,2/16)
 const bounds=new THREE.Box3().setFromObject(root);close(bounds.max.y,14/16);close(bounds.min.x,1/16);close(bounds.max.x,15/16)
})
test('讲台书使用完整七部件，封皮、书脊和独立翻页保持 1.21 尺寸',()=>{
 const book=models.openBook(assets)
 assert.deepEqual(book.children.map(p=>p.name),['left_lid','right_lid','seam','left_pages','right_pages','flip_page1','flip_page2'])
 const lid=book.getObjectByName('left_lid');close(lid.position.z,-1/16);close(lid.rotation.y,Math.PI+1.5)
 const size=new THREE.Box3().setFromObject(lid.children[0]).getSize(new THREE.Vector3());close(size.x,6/16);close(size.y,10/16);close(size.z,.005/16)
 close(book.getObjectByName('right_pages').position.z,Math.sin(1.5)/16)
})

test('箱子物品使用独立的 30°/45° GUI 姿态，与普通方块 225° 区分',()=>{
 const fixture={...assets,models:{'item/chest':{textures:{},elements:[],display:{gui:{rotation:[30,45,0],translation:[0,0,0],scale:[.625,.625,.625]}}}}}
 const item=gui.blockItem(fixture,'chest')
 close(item.rotation.x,Math.PI/6);close(item.rotation.y,Math.PI/4);close(item.scale.x,.625)
 item.updateMatrixWorld(true)
 const hinge=item.children[0].children[1],latch=hinge.children[1]
 const center=new THREE.Box3().setFromObject(latch).getCenter(new THREE.Vector3())
 assert.ok(center.z>0,'GUI 中锁扣面朝向相机，不应显示箱背')
})

test('讲台在单格地面上，悬灯连接横梁，桌灯使用顶面支撑',()=>{
 const room=layout.buildLayout(),lectern=layout.ZONES.find(z=>z.id==='lectern')
 assert.deepEqual(lectern.position,[-1,0,0]);assert.equal(lectern.size[0],1);assert.equal(lectern.size[2],1)
 assert.ok(room.cells.some(c=>c.position.join(',')==='-1,-1,0'))
 assert.ok(!room.decorations.some(d=>d.position.join(',')==='-1,0,0'),'不能叠放半砖或地毯穿入讲台')
 for(const p of layout.LANTERNS){assert.ok(p.every(Number.isInteger));assert.ok(room.cells.some(c=>c.position.join(',')===[p[0],p[1]+1,p[2]].join(',')&&c.material==='beam'))}
 assert.ok(room.decorations.some(d=>d.model==='block/lantern'&&d.position.join(',')==='2,2,-2'))
 for(const x of [2,3,4])assert.ok(room.cells.some(c=>c.material==='dark'&&c.position.join(',')===[x,1,-2].join(',')))
 for(const x of [2,4]){const leg=room.decorations.find(d=>d.model==='block/spruce_fence_post'&&d.position.join(',')===[x,0,-2].join(','));assert.ok(leg);assert.equal(leg.position[1]+1,1,'桌腿顶面与桌面底部相接')}
})

test('唱片机独占可见的地面格，与实体方块和栏杆无重叠',()=>{
 const room=layout.buildLayout(),zone=layout.ZONES.find(z=>z.id==='jukebox')
 assert.deepEqual(zone.position,[1,0,-1]);assert.deepEqual(zone.size,[1,1,1]);assert.ok(room.cells.some(c=>c.position.join(',')==='1,-1,-1'))
 const overlaps=p=>p.every((v,i)=>v<zone.position[i]+1&&v+1>zone.position[i])
 assert.ok(!room.cells.some(c=>overlaps(c.position)));assert.ok(!room.decorations.some(d=>overlaps(d.position)))
})

// Independently checked 1.21 ladder plane and UVs. Two explicitly opposite
// faces must each render only from their own side, even with a cutout map.
const ladder={textures:{},elements:[{from:[0,0,15.2],to:[16,16,15.2],shade:false,faces:{north:{texture:'block/ladder',uv:[0,0,16,16]},south:{texture:'block/ladder',uv:[16,0,0,16]}}}]}
const ladderAssets={models:{},textures:{'block/ladder':new THREE.Texture()}}
test('原版梯子双向贴片从各自正面渲染，不重复绘制共面反面',()=>{
 const mesh=models.buildModel(ladder,ladderAssets);mesh.updateMatrixWorld(true)
 const front=new THREE.Raycaster(new THREE.Vector3(.3,.4,-1),new THREE.Vector3(0,0,1)).intersectObject(mesh)
 const back=new THREE.Raycaster(new THREE.Vector3(.3,.4,2),new THREE.Vector3(0,0,-1)).intersectObject(mesh)
 assert.equal(front.length,1);assert.equal(back.length,1)
 assert.ok(front[0].face.normal.z<0);assert.ok(back[0].face.normal.z>0)
 mesh.geometry.dispose();mesh.material.forEach(m=>m.dispose())
})
test('两组梯子正确贴在木柱南侧，原版 0.05 格间隙避免深度冲突',()=>{
 const room=layout.buildLayout(),ladders=room.decorations.filter(d=>d.model==='block/ladder')
 assert.equal(ladders.length,8)
 for(const item of ladders){const mesh=models.buildModel(ladder,ladderAssets);mesh.position.set(...item.position);mesh.rotation.y=item.rotation;mesh.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(mesh),pillar=room.cells.find(c=>c.material==='pillar'&&Math.abs(c.position[0]-box.min.x)<1e-6&&c.position[1]===item.position[1]&&c.position[2]===-4);assert.ok(pillar);close(box.min.z-(pillar.position[2]+1),.05);close(box.max.z,box.min.z);close(box.max.x-box.min.x,1);mesh.geometry.dispose();mesh.material.forEach(m=>m.dispose())}
})
