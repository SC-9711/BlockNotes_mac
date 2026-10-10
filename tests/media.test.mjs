import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
const {serveAudio}=createRequire(import.meta.url)('../electron/local-media.cjs')
test('本地音频支持完整流、字节范围、尾部检索、HEAD 与非法范围',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'blocknotes-media-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const file=path.join(dir,'track.ogg');writeFileSync(file,'0123456789')
 const get=(range,method='GET')=>serveAudio(file,new Request('https://local/track.ogg',{method,headers:range?{range}:{}}))
 let response=get();assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'audio/ogg');assert.equal(response.headers.get('content-length'),'10');assert.equal(await response.text(),'0123456789')
 response=get('bytes=3-6');assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 3-6/10');assert.equal(await response.text(),'3456')
 response=get('bytes=-2');assert.equal(await response.text(),'89');response=get('bytes=7-');assert.equal(await response.text(),'789')
 response=get(null,'HEAD');assert.equal(response.headers.get('content-length'),'10');assert.equal(await response.text(),'')
 for(const range of ['bytes=20-','bytes=7-2','bytes=-0','bytes=','bytes=1-2,4-5','invalid'])assert.equal(get(range).status,416,range)
})
