// Geometry and material choices live here; this file never reads or writes notes.
export type Vec3=[number,number,number]
export type Cell={position:Vec3;material:keyof typeof PALETTE;axis?:'x'|'y'|'z'}
export type Decoration={model:string;position:Vec3;rotation?:number}
export type Zone={id:string;position:Vec3;size:Vec3}
export const ROOM={width:11,depth:10,height:6,camera:[3.5,3.05,4.7] as Vec3,target:[0,2.05,-2.6] as Vec3,fov:67}
// A second fixed view, not a player camera. The real lectern remains in the room.
export const LECTERN_VIEW={camera:[.8,2.5,3.1] as Vec3,target:[-.7,1.45,-.6] as Vec3,fov:58}
export const PALETTE={
 spruce:{texture:'block/spruce_planks'},oak:{texture:'block/oak_planks'},dark:{texture:'block/dark_oak_planks'},
 beam:{texture:'block/stripped_spruce_log',top:'block/stripped_spruce_log_top'},
 pillar:{texture:'block/dark_oak_log',top:'block/dark_oak_log_top'},
 stone:{texture:'block/stone_bricks'},mossy:{texture:'block/mossy_stone_bricks'},
 books:{texture:'block/bookshelf',top:'block/oak_planks'},glass:{texture:'block/glass'},
 grass:{texture:'block/grass_block_side',top:'block/grass_block_top',bottom:'block/dirt'}
}
export const requiredModels=['item/bookshelf','item/chest','item/lectern','item/jukebox','block/jukebox','block/lectern','block/lantern','block/lantern_hanging','block/spruce_slab','block/spruce_slab_top','block/dark_oak_slab','block/dark_oak_slab_top','block/spruce_fence_post','block/dark_oak_stairs','block/red_carpet','block/brown_carpet','block/potted_oak_sapling','block/potted_poppy','block/ladder','block/dark_oak_trapdoor_bottom']
export const requiredTextures=[...new Set(Object.values(PALETTE).flatMap(p=>Object.values(p))),'block/oak_leaves','entity/chest/normal','entity/enchanting_table_book','particle/note']
export const ZONES:Zone[]=[
 {id:'shelf:main',position:[-5,.5,-4],size:[3,4.5,1]},
 {id:'shelf:main',position:[-5,1,-3],size:[1,3,2]},
 {id:'shelf:ideas',position:[3,.5,-4],size:[3,4.5,1]},
 {id:'shelf:ideas',position:[5,1,-3],size:[1,3,2]},
 {id:'lectern',position:[-1,0,0],size:[1,1.2,1]},
 {id:'chest',position:[-3.8,.5,.35],size:[1,1,1]},
 {id:'jukebox',position:[1,0,-1],size:[1,1,1]}
]
export const LANTERNS:Vec3[]=[[-4,4,0],[3,4,0],[0,4,-4]]
export function buildLayout(){
 const map=new Map<string,Cell>(),decor:Decoration[]=[]
 const add=(x:number,y:number,z:number,material:Cell['material'],axis:Cell['axis']='y')=>map.set(`${x},${y},${z}`,{position:[x,y,z],material,axis})
 const item=(model:string,position:Vec3,rotation=0)=>decor.push({model:'block/'+model,position,rotation})
 for(let x=-5;x<=5;x++)for(let z=-4;z<=5;z++){const edge=Math.abs(x)===5||z===-4||z===5,inner=Math.abs(x)===4||z===-3||z===4;add(x,-1,z,edge?'dark':inner?'oak':'spruce');add(x,6,z,'dark')}
 for(let y=0;y<6;y++){
  for(let x=-5;x<=5;x++){if(Math.abs(x)<=1&&y>=2&&y<=3)continue;add(x,y,-5,y<2?(x%3===0?'mossy':'stone'):'spruce')}
  for(let z=-4;z<=5;z++){add(-6,y,z,y<2?'stone':'spruce');add(6,y,z,y<2?'stone':'spruce')}
 }
 // Deep jambs divide book bays from the centered window. Books sit between columns.
 for(const x of [-6,-2,2,6])for(let y=0;y<6;y++)add(x,y,-4,'pillar')
 for(const x of [-5,-4,-3,3,4,5]){
  add(x,0,-4,'dark');for(let y=1;y<5;y++)add(x,y,-4,'books');add(x,5,-4,'beam','x')
  item('spruce_slab',[x,.5,-3]);item('dark_oak_trapdoor_bottom',[x,4.9,-3])
 }
 for(const x of [-5,5])for(const z of [-3,-2]){add(x,0,z,'dark');for(let y=1;y<4;y++)add(x,y,z,'books');add(x,4,z,'beam','z')}
 // The nearer side wall has a shallower book recess, framed by structural logs.
 for(const z of [0,1,2]){for(const y of [1,2,3])add(-6,y,z,'books');add(-6,4,z,'beam','z')}
 for(const z of [-1,3])for(let y=0;y<6;y++)add(-6,y,z,'pillar')
 for(const x of [-5,5])for(let y=0;y<6;y++)add(x,y,-1,'pillar')
 for(const z of [-4,0,4])for(let x=-5;x<=5;x++)add(x,5,z,'beam','x')
 for(const x of [-4,0,4])for(let z=-3;z<=5;z++)item('dark_oak_slab',[x,5.5,z])
 // Slab moldings, window ledge, and a low storage bench enrich the wall silhouette.
 for(const x of [-1,0,1]){item('spruce_slab_top',[x,1,-4]);for(const y of [2,3])add(x,y,-5,'glass')}
 item('potted_poppy',[-1,2,-4]);item('potted_oak_sapling',[1,2,-4])
 for(const x of [-4,-3,-2]){item('spruce_slab',[x,0,.2]);add(x,0,-1,'spruce')}
 // Full plank blocks meet the fence posts at y=1 and support props at y=2.
 // Upper slabs would leave half a block of air between their bottom and legs.
 for(const x of [2,3,4]){add(x,1,-2,'dark');if(x!==3)item('spruce_fence_post',[x,0,-2])}
 item('dark_oak_stairs',[3,0,0],Math.PI/2);item('potted_oak_sapling',[4,2,-2]);item('lantern',[2,2,-2])
 // A single-cell lectern rests directly on the floor; the carpet avoids its cell. All proportions use actual block models.
 for(let x=-2;x<=2;x++)for(let z=0;z<4;z++)if(!(x===-1&&z===0))item(Math.abs(x)===2?'brown_carpet':'red_carpet',[x,0,z])
 // Native north-facing plane is at local z=15.2/16. Rotate it 180° and
 // compensate its corner-origin translation: each occupies the air cell in
 // front of the pillar, 0.05 blocks away from its south face (never coplanar).
 for(let y=1;y<5;y++){item('ladder',[-1,y,-2],Math.PI);item('ladder',[3,y,-2],Math.PI)}
 return {cells:[...map.values()],decorations:decor}
}
