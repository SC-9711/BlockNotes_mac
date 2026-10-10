import { _electron as electron,expect } from '@playwright/test'
import electronPath from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {createHash} from 'node:crypto'
const output=path.resolve('artifacts/screenshots'),data=fs.mkdtempSync(path.join(os.tmpdir(),'blocknotes-visual-'))
fs.mkdirSync(output,{recursive:true})
const executable=process.env.BLOCKNOTES_TEST_EXE,env={...process.env,BLOCKNOTES_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE
const app=await electron.launch({executablePath:executable||electronPath,args:executable?[]:['.'],env})
try{

 const page=await app.firstWindow(),errors=[],external=[]
 page.on('pageerror',e=>errors.push(e.message))
 page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())})
 await page.locator('.world[data-ready="true"]').waitFor({timeout:30000})
 await page.evaluate(()=>document.fonts.ready)

 await expect(page.locator('.scene-fallback')).toHaveCount(0)
 const close=async()=>{await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await page.mouse.move(20,20);await page.waitForTimeout(800)}
 const capture=async name=>{await page.waitForTimeout(800);await expect(page.locator('.toast')).toHaveCount(0,{timeout:6000});await page.screenshot({path:path.join(output,name+'.png')})}
 await page.mouse.move(20,20);await capture('room')
 await page.locator('.hotbar').screenshot({path:path.join(output,'hotbar.png')})
 await page.screenshot({path:path.join(output,'chest-detail.png'),clip:{x:135,y:465,width:195,height:190}})
 if(!process.env.BLOCKNOTES_VISUAL_FOCUS){
 for(const [i,title] of ['书房空间设计','实现与验收记录','待整理的阅读摘录'].entries()){
  await page.keyboard.press('Control+n');await expect(page.getByRole('dialog',{name:'书与笔编辑'})).toBeVisible()
  await page.locator('.tiptap').fill(i===0?'项目笔记\n先完成核心流程，再整理实现细节。\n书架用于分类，归档保留历史记录。\n所有笔记保存到本机。':'记录今天的想法与阅读摘录，按主题整理。')
  await page.getByRole('button',{name:'书名与标签…',exact:true}).click()
  await page.getByRole('textbox',{name:'笔记标题',exact:true}).fill(title)
  await page.keyboard.press('Control+s');await expect(page.locator('.page-footer')).toContainText('已保存到本机')
  if(i===0){await page.getByRole('button',{name:'收起',exact:true}).click();await capture('book');await page.getByRole('button',{name:'下一页',exact:true}).click();await capture('book-blank-page');await page.getByRole('button',{name:'上一页',exact:true}).click();await page.getByRole('button',{name:'书名与标签…',exact:true}).click();await capture('book-metadata')}
  if(i===2){await page.getByRole('button',{name:'收进归档箱',exact:true}).click();await expect(page.getByRole('dialog',{name:'归档箱',exact:true})).toBeVisible();await capture('chest')}
  await close()
 }
 await page.keyboard.press('4');await expect(page.getByRole('dialog',{name:'书架管理',exact:true})).toBeVisible();await capture('shelf');await close()
 await page.keyboard.press('Control+k');await page.getByRole('textbox',{name:'搜索笔记',exact:true}).fill('核心流程');await expect(page.locator('.note-slot')).toHaveCount(1);await capture('search');await close()
 await page.keyboard.press('7');await expect(page.getByRole('dialog',{name:'唱片机',exact:true})).toBeVisible();await page.getByRole('button',{name:'播放 Cat',exact:true}).click();await capture('jukebox');await close();await expect(page.locator('.record-notice')).toContainText('C418 - cat');await expect.poll(()=>page.locator('canvas').getAttribute('data-note-visible'),{intervals:[25]}).toBe('true');await page.screenshot({path:path.join(output,'room-record-playing.png')})
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'游戏菜单',exact:true})).toBeVisible();await capture('pause')
 await page.getByRole('button',{name:'选项…',exact:true}).click();await capture('menu-settings');await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'操作指引…',exact:true}).click();await capture('controls');await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'游戏菜单',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.getByRole('button',{name:'书与笔 · 新建笔记',exact:true}).hover();await expect(page.getByRole('tooltip')).toContainText('书与笔');await capture('hotbar-tooltip');await page.mouse.move(20,20)
 }else{await page.keyboard.press('7');await expect(page.getByRole('dialog',{name:'唱片机',exact:true})).toBeVisible();await page.getByRole('button',{name:'播放 Cat',exact:true}).click();await close()}
 const size=await page.evaluate(()=>({w:innerWidth,h:innerHeight}));await page.mouse.move(size.w*.34,size.h*.44);await expect(page.locator('.hover-label')).toContainText('知识书架');await capture('room-hover')
 // Disc playback keeps the demand canvas rendering at 20 Hz. After each
 // camera pose settles, both ladder regions must remain identical over frames.
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
 const regions=[{x:Math.round(size.w*.35),y:Math.round(size.h*.12),width:Math.round(size.w*.14),height:Math.round(size.h*.43)},{x:Math.round(size.w*.62),y:Math.round(size.h*.12),width:Math.round(size.w*.12),height:Math.round(size.h*.43)}]
 for(const [i,p] of [[.05,.05],[.95,.05],[.05,.9],[.95,.9],[.5,.1]].entries()){
  await page.evaluate(()=>{if(window.__visualPointerGuard)for(const name of ['pointermove','pointerover','pointerout','pointerleave','pointerenter'])window.removeEventListener(name,window.__visualPointerGuard,true)});await page.mouse.move(size.w*p[0],size.h*p[1]);await page.evaluate(()=>{window.__visualPointerGuard=e=>e.stopImmediatePropagation();for(const name of ['pointermove','pointerover','pointerout','pointerleave','pointerenter'])window.addEventListener(name,window.__visualPointerGuard,true)});await expect.poll(()=>page.locator('canvas').getAttribute('data-camera-pointer'),{timeout:15000}).toBe([(p[0]*2-1).toFixed(2),(1-p[1]*2).toFixed(2)].join(','));await expect.poll(()=>page.locator('canvas').getAttribute('data-camera-settled'),{timeout:15000}).toBe('true');await page.waitForTimeout(100)
  for(const [region,clip] of regions.entries()){const beforeState=await page.evaluate(()=>({size:[innerWidth,innerHeight],data:{...document.querySelector('canvas').dataset}}));const first=await page.screenshot({clip});for(let frame=0;frame<3;frame++){await page.waitForTimeout(100);const next=await page.screenshot({clip});if(digest(next)!==digest(first)){console.log(JSON.stringify({beforeState,afterState:await page.evaluate(()=>({size:[innerWidth,innerHeight],data:{...document.querySelector('canvas').dataset}}))}));fs.writeFileSync(path.join(output,`ladder-unstable-${i}-${region}-before.png`),first);fs.writeFileSync(path.join(output,`ladder-unstable-${i}-${region}-after.png`),next);throw new Error('Ladder region changed after camera settled at pose '+i)}}}
  await page.screenshot({path:path.join(output,'ladder-view-'+i+'.png')})
 }
 await page.evaluate(()=>{for(const name of ['pointermove','pointerover','pointerout','pointerleave','pointerenter'])window.removeEventListener(name,window.__visualPointerGuard,true)})
 await page.screenshot({path:path.join(output,'ladder-fixed.png'),clip:{x:Math.round(size.w*.31),y:Math.round(size.h*.12),width:Math.round(size.w*.43),height:Math.round(size.h*.46)}})
 await page.screenshot({path:path.join(output,'desk-support-fixed.png'),clip:{x:Math.round(size.w*.61),y:Math.round(size.h*.46),width:Math.round(size.w*.31),height:Math.round(size.h*.4)}})
 await page.screenshot({path:path.join(output,'lectern-scale-checked.png'),clip:{x:Math.round(size.w*.25),y:Math.round(size.h*.6),width:Math.round(size.w*.17),height:Math.round(size.h*.27)}})
 if(errors.length||external.length)throw new Error(JSON.stringify({errors,external}))
 console.log(JSON.stringify({executable:executable||electronPath,screenshots:output,externalRequests:external.length,pageErrors:errors.length,ladderViews:5,stableLadderFrames:30}))
}finally{
 await app.close()
 const resolved=path.resolve(data)
 if(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('blocknotes-visual-'))fs.rmSync(resolved,{recursive:true,force:true})
}
