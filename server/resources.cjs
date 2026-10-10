// Downloads original files only on the user's computer; public packages carry hashes and code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Readable,Transform}=require('node:stream'),{pipeline}=require('node:stream/promises');
const yauzl=require('yauzl');
const reference=require('../electron/resource-reference.json');
const selected=require('../electron/resource-selection.cjs');
const {buildPixelFont}=require('./pixel-font.cjs');
const CLIENT=reference.clientSha1,INDEX=reference.indexSha1,UNIFONT='666999116c467f10622db1527a06ddc0a6efad2a';
const SOUND_EVENTS=['ui.button.click','block.chest.open','block.chest.close','item.book.page_turn','item.book.put','block.chiseled_bookshelf.pickup','block.chiseled_bookshelf.insert'];
const recipe=crypto.createHash('sha256').update(JSON.stringify(reference)).digest('hex');
const hash=bytes=>crypto.createHash('sha1').update(bytes).digest('hex');
const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
function inside(root,relative){const file=path.resolve(root,relative);if(!file.startsWith(path.resolve(root)+path.sep))throw new Error('资源路径不合法');return file;}
function verifyFile(file,sha1,size){try{const stat=fs.lstatSync(file);return stat.isFile()&&(size===undefined||stat.size===size)&&hash(fs.readFileSync(file))===sha1;}catch{return false;}}
function validatePack(root){
  try{
    for(const entry of reference.files)if(!verifyFile(inside(root,entry.path),entry.sha1,entry.size))return false;
    const sounds=readJSON(inside(root,'sounds/manifest.json')),music=readJSON(inside(root,'sounds/music-manifest.json')),names=readJSON(inside(root,'record-names.json'));
    if(sounds.version!=='1.21'||sounds.definitionSha1!=='09eab141cce7550f9a74c65db0e9abbb342cf50f'||music.version!=='1.21'||music.indexSha1!==INDEX||music.definitionSha1!==sounds.definitionSha1||music.tracks.length!==19||names.clientSha1!==CLIENT)return false;
    const ids=new Set();for(const t of music.tracks){if(!/^records\/[a-z0-9_]+$/.test(t.id)||ids.has(t.id)||!names.descriptions[t.id]||!reference.files.some(f=>f.path==='sounds/'+t.id+'.ogg'&&f.sha1===t.sha1))return false;ids.add(t.id);}
    return SOUND_EVENTS.every(event=>Array.isArray(sounds.events[event]?.sounds));
  }catch{return false;}
}
function activePack(userData){
  try{const active=readJSON(path.join(userData,'resource-packs/active.json'));if(active.recipe!==recipe||!/^minecraft-1\.21-[a-z0-9-]+$/.test(active.directory))return null;const root=inside(path.join(userData,'resource-packs'),active.directory);return validatePack(root)?root:null;}catch{return null;}
}
function officialURL(url){return /^https:\/\/(?:piston-data\.mojang\.com\/v1\/objects\/|piston-meta\.mojang\.com\/v1\/packages\/|resources\.download\.minecraft\.net\/)[a-z0-9/._-]+$/.test(url);}
async function downloadVerified(url,destination,sha1,{fetcher=fetch,signal,onProgress=()=>{}}={}){
  if(!officialURL(url)||!/^\w{40}$/.test(sha1))throw new Error('资源来源不合法');
  if(verifyFile(destination,sha1))return destination;
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  for(let attempt=0;attempt<3;attempt++){
    signal?.throwIfAborted();const partial=destination+'.download';
    try{
      const response=await fetcher(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(180000)]):AbortSignal.timeout(180000),redirect:'error'});
      if(!response.ok||!response.body)throw new Error('资源下载失败 HTTP '+response.status);
      const total=Number(response.headers.get('content-length'))||0;if(total>150*1024*1024)throw new Error('资源文件超出预期大小');
      let received=0;const digest=crypto.createHash('sha1');
      const meter=new Transform({transform(chunk,_encoding,done){received+=chunk.length;if(received>150*1024*1024){done(new Error('资源文件超出预期大小'));return;}digest.update(chunk);onProgress(received,total);done(null,chunk);}});
      await pipeline(Readable.fromWeb(response.body),meter,fs.createWriteStream(partial,{flags:'w'}));signal?.throwIfAborted();
      if(digest.digest('hex')!==sha1)throw new Error('资源校验失败，请重试');
      fs.renameSync(partial,destination);return destination;
    }catch(error){if(fs.existsSync(partial))fs.unlinkSync(partial);if(signal?.aborted||attempt===2)throw error;}
  }
}
async function zipReader(file){
  const zip=await new Promise((resolve,reject)=>yauzl.open(file,{lazyEntries:true,autoClose:false},(error,value)=>error?reject(error):resolve(value)));
  const entries=new Map();
  try{await new Promise((resolve,reject)=>{zip.on('entry',entry=>{entries.set(entry.fileName,entry);zip.readEntry();});zip.once('end',resolve);zip.once('error',reject);zip.readEntry();});}catch(error){zip.close();throw error;}
  return{has:name=>entries.has(name),close:()=>zip.close(),async read(name){
    const entry=entries.get(name);if(!entry||entry.uncompressedSize>64*1024*1024)throw new Error('原版资源缺失或过大：'+name);
    const stream=await new Promise((resolve,reject)=>zip.openReadStream(entry,(error,value)=>error?reject(error):resolve(value)));
    const chunks=[];let size=0;for await(const chunk of stream){size+=chunk.length;if(size>64*1024*1024)throw new Error('解压资源超出预期大小');chunks.push(chunk);}return Buffer.concat(chunks);
  }};
}
async function extractClient(file,root,signal){
  const zip=await zipReader(file),queue=[...selected,...reference.files.filter(f=>!f.path.startsWith('sounds/')&&!f.path.endsWith('.otf')).map(f=>f.path)],visited=new Set();
  try{
    while(queue.length){signal?.throwIfAborted();const relative=queue.shift();if(visited.has(relative))continue;visited.add(relative);const key='assets/minecraft/'+relative,data=await zip.read(key),target=inside(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);
      if(relative.startsWith('models/')&&relative.endsWith('.json')){const model=JSON.parse(data);if(model.parent&&!model.parent.includes('builtin/'))queue.push('models/'+model.parent.replace('minecraft:','')+'.json');for(const value of Object.values(model.textures||{}))if(!value.startsWith('#'))queue.push('textures/'+value.replace('minecraft:','')+'.png');}
      if(relative.endsWith('.png')&&zip.has(key+'.mcmeta'))queue.push(relative+'.mcmeta');
    }
    const language=JSON.parse(await zip.read('assets/minecraft/lang/en_us.json')),descriptions={};for(const [key,value] of Object.entries(language))if(key.startsWith('jukebox_song.minecraft.'))descriptions['records/'+key.slice('jukebox_song.minecraft.'.length)]=value;
    fs.writeFileSync(inside(root,'record-names.json'),JSON.stringify({version:'1.21',clientSha1:CLIENT,descriptions},null,2));
  }finally{zip.close();}
}
async function installResources(userData,{fetcher=fetch,signal,onProgress=()=>{}}={}){
  const current=activePack(userData);if(current)return current;
  const packs=path.join(path.resolve(userData),'resource-packs'),cache=path.join(packs,'cache');fs.mkdirSync(cache,{recursive:true});
  const stage=fs.mkdtempSync(path.join(packs,'.stage-'));
  const progress=(stageName,done=0,total=0)=>onProgress({phase:stageName,done,total});
  const obtain=(url,name,sha1,label)=>downloadVerified(url,inside(cache,name),sha1,{fetcher,signal,onProgress:(done,total)=>progress(label,done,total)});
  try{
    progress('下载 Java 1.21 客户端资源');const client=await obtain('https://piston-data.mojang.com/v1/objects/'+CLIENT+'/client.jar','client-1.21.jar',CLIENT,'下载 Java 1.21 客户端资源');
    progress('读取原版资源索引');const indexFile=await obtain('https://piston-meta.mojang.com/v1/packages/'+INDEX+'/17.json','index-1.21.json',INDEX,'读取原版资源索引'),index=readJSON(indexFile).objects;
    const definition=index['minecraft/sounds.json'];if(definition?.hash!=='09eab141cce7550f9a74c65db0e9abbb342cf50f')throw new Error('原版音效定义不一致');
    const defFile=await obtain('https://resources.download.minecraft.net/'+definition.hash.slice(0,2)+'/'+definition.hash,'sounds-1.21.json',definition.hash,'读取原版音效定义'),events=readJSON(defFile);
    progress('提取原版方块、道具与界面');await extractClient(client,stage,signal);
    const fontZip=await obtain('https://resources.download.minecraft.net/66/'+UNIFONT,'unifont.zip',UNIFONT,'准备像素字体'),font=await zipReader(fontZip);
    try{for(const [entry,relative] of [['unifont_all_no_pua-15.1.05.hex','font/source/unifont_all_no_pua-15.1.05.hex'],['LICENSE.txt','font/LICENSE-Unifont.txt']]){const target=inside(stage,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,await font.read(entry));}}finally{font.close();}
    signal?.throwIfAborted();progress('生成与演示相同的像素字体');buildPixelFont(stage,inside(stage,'font/source/unifont_all_no_pua-15.1.05.hex'),reference.fontTimestamp);
    fs.copyFileSync(path.join(__dirname,'pixel-font.cjs'),inside(stage,'font/source/pixel-font.cjs'));
    const sources={},soundManifest={version:'1.21',definitionSha1:definition.hash,events:{},sources},tracks=[];
    for(const event of SOUND_EVENTS){if(!events[event])throw new Error('音效事件缺失');soundManifest.events[event]=events[event];for(const sample of events[event].sounds){const name=typeof sample==='string'?sample:sample.name,asset=index['minecraft/sounds/'+name+'.ogg'];if(!asset)throw new Error('音效文件缺失');sources[name]={sha1:asset.hash,size:asset.size};}}
    const names=readJSON(inside(stage,'record-names.json'));
    for(const event of Object.keys(events).filter(name=>name.startsWith('music_disc.'))){for(const sample of events[event].sounds){const name=(typeof sample==='string'?sample:sample.name).replace(/^minecraft:/,''),asset=index['minecraft/sounds/'+name+'.ogg'];if(!asset||!names.descriptions[name])throw new Error('唱片资源缺失');tracks.push({id:name,title:name.split('/').at(-1).split('_').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '),groups:['records'],sha1:asset.hash,size:asset.size,description:names.descriptions[name]});}}
    tracks.sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id));if(tracks.length!==19)throw new Error('唱片数量与演示版本不一致');
    const samples=[...Object.entries(sources).map(([name,asset])=>({name,...asset})),...tracks.map(t=>({name:t.id,sha1:t.sha1,size:t.size}))];let cursor=0,finished=0;
    const downloads=await Promise.allSettled(Array.from({length:4},async()=>{while(cursor<samples.length){signal?.throwIfAborted();const sample=samples[cursor++],target=inside(stage,'sounds/'+sample.name+'.ogg');progress('准备原版音效与 19 张唱片',finished,samples.length);await obtain('https://resources.download.minecraft.net/'+sample.sha1.slice(0,2)+'/'+sample.sha1,sample.sha1+'.ogg',sample.sha1,'下载原版音频');fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(inside(cache,sample.sha1+'.ogg'),target);progress('准备原版音效与 19 张唱片',++finished,samples.length);}}));
    const failed=downloads.find(result=>result.status==='rejected');if(failed)throw failed.reason;
    fs.writeFileSync(inside(stage,'sounds/manifest.json'),JSON.stringify(soundManifest,null,2));fs.writeFileSync(inside(stage,'sounds/music-manifest.json'),JSON.stringify({version:'1.21',indexSha1:INDEX,definitionSha1:definition.hash,tracks},null,2));
    signal?.throwIfAborted();progress('校验全部资源与演示版本一致');if(!validatePack(stage))throw new Error('资源包与实机演示基准不一致，未启用');
    const directory='minecraft-1.21-'+crypto.randomUUID(),destination=inside(packs,directory);fs.renameSync(stage,destination);
    const pointer=path.join(packs,'active.json'),temporary=pointer+'.tmp';fs.writeFileSync(temporary,JSON.stringify({version:'1.21',recipe,directory}));fs.renameSync(temporary,pointer);progress('资源已就绪');return destination;
  }finally{if(path.dirname(stage)===packs&&path.basename(stage).startsWith('.stage-')&&fs.existsSync(stage))fs.rmSync(stage,{recursive:true,force:true});}
}
module.exports={reference,recipe,inside,verifyFile,validatePack,activePack,officialURL,downloadVerified,zipReader,extractClient,installResources};
