import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{inside,officialURL,downloadVerified,installResources,activePack}=require('../server/resources.cjs'),{buildPixelFont}=require('../server/pixel-font.cjs'),{PNG}=require('pngjs')
const sha=bytes=>createHash('sha1').update(bytes).digest('hex')
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'blocknotes-resources-'));t.after(()=>{if(path.dirname(root)===path.resolve(os.tmpdir())&&path.basename(root).startsWith('blocknotes-resources-'))fs.rmSync(root,{recursive:true,force:true})});return root}
test('资源路径限制与官方来源白名单拒绝目录穿越及其他域名',()=>{
 assert.throws(()=>inside('safe','../private.sqlite'))
 assert.ok(officialURL('https://resources.download.minecraft.net/ab/'+'a'.repeat(40)))
 for(const url of ['http://resources.download.minecraft.net/a','https://resources.download.minecraft.net.evil.test/a','https://evil.test/a','file:///private'])assert.equal(officialURL(url),false)
})
test('下载哈希校验、缓存复用与错误重试不启用坏资源',async t=>{
 const root=fixture(t),file=path.join(root,'cache.bin'),bytes=Buffer.from('original synthetic fixture'),url='https://resources.download.minecraft.net/ab/'+sha(bytes)
 let calls=0;const fetcher=async()=>{calls++;return new Response(bytes)}
 await downloadVerified(url,file,sha(bytes),{fetcher});assert.equal(calls,1);assert.deepEqual(fs.readFileSync(file),bytes)
 await downloadVerified(url,file,sha(bytes),{fetcher});assert.equal(calls,1)
 const bad=path.join(root,'bad.bin');await assert.rejects(downloadVerified(url,bad,sha(bytes),{fetcher:async()=>new Response('corrupted')}),/校验失败/);assert.equal(fs.existsSync(bad),false);assert.equal(fs.existsSync(bad+'.download'),false)
})
test('首次准备失败保留笔记与旧激活指针，不留下可用的新资源包',async t=>{
 const root=fixture(t),notes=path.join(root,'blocknotes.sqlite'),pointer=path.join(root,'resource-packs/active.json')
 fs.writeFileSync(notes,'do not modify user data');fs.mkdirSync(path.dirname(pointer));fs.writeFileSync(pointer,'{"old":"pointer"}')
 await assert.rejects(installResources(root,{fetcher:async()=>{throw new Error('offline')}}),/offline/)
 assert.equal(fs.readFileSync(notes,'utf8'),'do not modify user data');assert.equal(fs.readFileSync(pointer,'utf8'),'{"old":"pointer"}');assert.equal(activePack(root),null)
 assert.equal(fs.readdirSync(path.dirname(pointer)).some(name=>name.startsWith('.stage-')),false)
})
test('像素字体转换只使用合成夹具，同一字形输出稳定',t=>{
 const root=fixture(t);fs.mkdirSync(path.join(root,'textures/font'),{recursive:true});const png=new PNG({width:128,height:128});png.data.fill(0)
 for(let y=0;y<8;y++)png.data[((4*8+y)*128+1*8+y)*4+3]=255
 fs.writeFileSync(path.join(root,'textures/font/ascii.png'),PNG.sync.write(png));const hex=path.join(root,'glyph.hex');fs.writeFileSync(hex,'4E00:'+('FF'.repeat(16))+'\n')
 const first=buildPixelFont(root,hex),bytes=fs.readFileSync(path.join(root,'font/minecraft-pixel.otf'));const second=buildPixelFont(root,hex)
 assert.deepEqual(first,second);assert.deepEqual(fs.readFileSync(path.join(root,'font/minecraft-pixel.otf')),bytes)
})
