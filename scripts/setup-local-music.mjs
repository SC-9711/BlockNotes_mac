import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'

// Original resources stay in the ignored local pack, outside public builds.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,''))
const sha=bytes=>createHash('sha1').update(bytes).digest('hex')
const indexBytes=fs.readFileSync(path.join(root,'.local/tooling/minecraft-assets-index.json'))
if(sha(indexBytes)!=='00551f206ccb65cb965fd0aebc14d22cda282db7')throw new Error('1.21 asset index checksum mismatch; run setup-local-resources.ps1 first')
const index=read('.local/tooling/minecraft-assets-index.json').objects
const definitionBytes=fs.readFileSync(path.join(root,'.local/tooling/sounds-1.21.json'))
if(sha(definitionBytes)!==index['minecraft/sounds.json'].hash)throw new Error('1.21 sound definition checksum mismatch')
const events=read('.local/tooling/sounds-1.21.json'),tracks=new Map()
function collect(event,group,seen=new Set()){
 if(seen.has(event))throw new Error('Cyclic sound event: '+event)
 const definition=events[event];if(!definition)throw new Error('Missing event: '+event)
 for(const entry of definition.sounds){
  const sample=typeof entry==='string'?{name:entry}:entry
  if(sample.type==='event'){collect(sample.name,group,new Set([...seen,event]));continue}
  const name=sample.name.replace(/^minecraft:/,''),asset=index['minecraft/sounds/'+name+'.ogg']
  if(!asset)throw new Error('Missing music asset: '+name)
  if(!tracks.has(name))tracks.set(name,{id:name,title:name.split('/').at(-1).split('_').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '),groups:[],sha1:asset.hash,size:asset.size})
  const track=tracks.get(name);if(!track.groups.includes(group))track.groups.push(group)
 }
}
for(const event of Object.keys(events).filter(name=>name.startsWith('music_disc.')))collect(event,'records')
const items=[...tracks.values()].sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id))
const names=read('public/minecraft/record-names.json')
if(names.version!=='1.21'||names.clientSha1!=='0e9a07b9bb3390602f977073aa12884a4ce12431')throw new Error('Record descriptions must come from the verified 1.21 client')
for(const track of items){track.description=names.descriptions[track.id];if(!track.description)throw new Error('Missing native disc description: '+track.id)}
let done=0,total=0
async function download(track){
 const target=path.resolve(root,'public/minecraft/sounds/'+track.id+'.ogg')
 if(!target.startsWith(path.join(root,'public/minecraft/sounds')+path.sep))throw new Error('Music path escaped local pack')
 fs.mkdirSync(path.dirname(target),{recursive:true})
 if(fs.existsSync(target)){if(sha(fs.readFileSync(target))!==track.sha1)throw new Error('Existing music checksum mismatch: '+track.id)}
 else{
  const partial=target+'.download',url='https://resources.download.minecraft.net/'+track.sha1.slice(0,2)+'/'+track.sha1
  await new Promise((resolve,reject)=>{const process=spawn('curl.exe',['-fsSL','--ssl-revoke-best-effort','--retry','2','--connect-timeout','15','--max-time','180','-o',partial,url],{windowsHide:true,stdio:['ignore','ignore','pipe']});let error='';process.stderr.on('data',data=>{error+=data});process.on('error',reject);process.on('close',code=>code===0?resolve():reject(new Error(track.id+': '+error)))})
  if(sha(fs.readFileSync(partial))!==track.sha1)throw new Error('Downloaded music checksum mismatch: '+track.id)
  fs.renameSync(partial,target)
 }
 total+=track.size;if(++done%10===0||done===items.length)console.log('Verified music '+done+'/'+items.length)
}
let cursor=0
await Promise.all(Array.from({length:4},async()=>{while(cursor<items.length)await download(items[cursor++])}))
// Remove only verified background files from the previous generated manifest.
// Never recursively delete a computed directory or touch unknown user files.
const manifestPath=path.join(root,'public/minecraft/sounds/music-manifest.json')
if(fs.existsSync(manifestPath)){
 const previous=read('public/minecraft/sounds/music-manifest.json')
 for(const track of previous.tracks||[]){
  if(!/^music\/[a-z0-9_/]+$/.test(track.id))continue
  const target=path.resolve(root,'public/minecraft/sounds/'+track.id+'.ogg'),asset=index['minecraft/sounds/'+track.id+'.ogg']
  if(!target.startsWith(path.join(root,'public/minecraft/sounds/music')+path.sep)||!asset||asset.hash!==track.sha1)throw new Error('Unexpected obsolete music path')
  if(fs.existsSync(target)){if(sha(fs.readFileSync(target))!==asset.hash)throw new Error('Unrecognized music file, leaving it intact: '+track.id);fs.unlinkSync(target)}
 }
}
fs.writeFileSync(path.join(root,'public/minecraft/sounds/music-manifest.json'),JSON.stringify({version:'1.21',indexSha1:sha(indexBytes),definitionSha1:sha(definitionBytes),tracks:items},null,2)+'\n')
console.log(JSON.stringify({background:items.filter(t=>!t.groups.includes('records')).length,discs:items.filter(t=>t.groups.includes('records')).length,bytes:total}))
