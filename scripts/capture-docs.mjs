// Publishable screenshots from fictional notes in a disposable database.
import {_electron as electron,expect} from '@playwright/test'
import electronPath from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
const {openStore}=createRequire(import.meta.url)('../server/storage.cjs')
const output=path.resolve('docs/screenshots'),data=fs.mkdtempSync(path.join(os.tmpdir(),'blocknotes-docs-')),example=JSON.parse(fs.readFileSync('examples/study-notes.json','utf8'))
fs.mkdirSync(output,{recursive:true})
const store=openStore(data,{dailyBackup:false})
for(const [id,name] of Object.entries(example.shelves))store.run('shelf',{id,name})
let readingId
for(const item of example.notes){const content=[];for(const [i,text] of item.pages.entries()){if(i)content.push({type:'bookPageBreak'});for(const line of text.split('\n'))content.push({type:'paragraph',...(line?{content:[{type:'text',text:line}]}:{})})}let note=store.run('create',{title:item.title,shelfId:item.shelfId,tags:item.tags,doc:{type:'doc',content}});if(item.status==='archived')note=store.run('location',{id:note.id,revision:note.revision,status:'archived'});if(item.title==='英语阅读｜长句先找主干')readingId=note.id}
store.run('settings',{key:'lastNoteId',value:readingId});const before=store.run('snapshot').notes;store.close()
const env={...process.env,BLOCKNOTES_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.BLOCKNOTES_DEV_URL
const executable=process.env.BLOCKNOTES_TEST_EXE||electronPath
const app=await electron.launch({executablePath:executable,args:process.env.BLOCKNOTES_TEST_EXE?[]:['.'],env}),errors=[]
try{
 const page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.locator('.world[data-ready=true]').waitFor({timeout:30000});await expect(page.locator('.scene-fallback')).toHaveCount(0);await page.evaluate(()=>document.fonts.ready)
 const capture=async name=>{await page.mouse.move(15,15);await page.waitForTimeout(600);await page.screenshot({path:path.join(output,name+'.png')})}
 const close=async()=>{await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0)}
 await expect.poll(()=>page.locator('canvas').getAttribute('data-camera-settled')).toBe('true');await capture('room')
 await page.keyboard.press('4');await expect(page.getByRole('dialog',{name:'书架管理',exact:true})).toBeVisible();await capture('shelves')
 await page.getByRole('button',{name:'离散数学｜命题否定别凭直觉',exact:true}).click();await expect(page.getByRole('dialog',{name:'书与笔编辑',exact:true})).toBeVisible();await page.getByRole('button',{name:'上一页',exact:true}).click().catch(()=>{});await page.locator('.page-scroll').evaluate(node=>node.scrollTo({top:0}));await capture('editor')
 await page.getByRole('button',{name:'书名与标签…',exact:true}).click();await capture('metadata');await close()
 await page.keyboard.press('5');await expect(page.getByRole('dialog',{name:'讲台阅读',exact:true})).toBeVisible();await page.getByRole('button',{name:'阅读 英语阅读｜长句先找主干',exact:true}).click();await expect.poll(()=>page.locator('canvas').getAttribute('data-camera-settled'),{timeout:15000}).toBe('true');await capture('lectern');await close()
 await page.keyboard.press('Control+k');await page.getByRole('textbox',{name:'搜索笔记',exact:true}).fill('英语');await expect.poll(()=>page.locator('.note-slot').count()).toBeGreaterThan(0);await capture('search');await close()
 await page.keyboard.press('6');await expect(page.getByRole('dialog',{name:'归档箱',exact:true})).toBeVisible();await capture('archive');await close()
 await page.keyboard.press('7');await expect(page.getByRole('dialog',{name:'唱片机',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'播放 Cat',exact:true})).toBeVisible();await capture('jukebox');await close()
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'游戏菜单',exact:true})).toBeVisible();await capture('pause');await page.keyboard.press('Escape')
 const after=await page.evaluate(()=>window.blocknotes.call('snapshot')),fingerprint=n=>createHash('sha256').update(JSON.stringify(n)).digest('hex');expect(after.notes.map(fingerprint).sort()).toEqual(before.map(fingerprint).sort());expect(errors).toEqual([])
 fs.mkdirSync('.local/github-publication/logs',{recursive:true});fs.writeFileSync('.local/github-publication/logs/screenshots.json',JSON.stringify({screenshots:9,source:'Actual Windows app; original fictional study-note fixtures',notes:before.length,noteDataUnchanged:true,pageErrors:errors},null,2));console.log(JSON.stringify({screenshots:9,notes:before.length,pageErrors:errors}))
}finally{await app.close();if(path.dirname(data)===path.resolve(os.tmpdir())&&path.basename(data).startsWith('blocknotes-docs-'))fs.rmSync(data,{recursive:true,force:true})}
