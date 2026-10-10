import {_electron as electron,expect} from '@playwright/test'
import electronPath from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {DatabaseSync} from 'node:sqlite'
import {createHash} from 'node:crypto'
const data=fs.mkdtempSync(path.join(os.tmpdir(),'blocknotes-lectern-preview-')),output=path.resolve('artifacts/screenshots/lectern-workbench');fs.mkdirSync(output,{recursive:true})
fs.mkdirSync('artifacts/delivery/lectern-2026-10-10/logs',{recursive:true})
const source=new DatabaseSync(path.join(process.env.APPDATA,'blocknotes/blocknotes.sqlite'),{readOnly:true});try{source.exec('PRAGMA busy_timeout=5000');source.prepare('VACUUM INTO ?').run(path.join(data,'blocknotes.sqlite'))}finally{source.close()}
const env={...process.env,BLOCKNOTES_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.BLOCKNOTES_DEV_URL
const executable=process.env.BLOCKNOTES_TEST_EXE,app=await electron.launch({executablePath:executable||electronPath,args:executable?[]:['.'],env}),errors=[]
try{
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await expect(page.locator('.world')).toHaveAttribute('data-ready','true');await page.evaluate(()=>document.fonts.ready)
 const before=await page.evaluate(()=>window.blocknotes.call('snapshot')),fingerprint=n=>createHash('sha256').update(JSON.stringify([n.title,n.doc,n.tags,n.shelfId,n.status,n.previousStatus,n.revision,n.createdAt,n.updatedAt])).digest('hex'),original=new Map(before.notes.map(n=>[n.id,fingerprint(n)]))
 await page.mouse.move(20,20);await page.waitForTimeout(1500);await page.screenshot({path:path.join(output,'01-room.png')})
 await page.keyboard.press('5');await expect(page.getByRole('dialog',{name:'讲台阅读',exact:true})).toBeVisible();await expect.poll(()=>page.locator('canvas').getAttribute('data-camera-view')).toBe('lectern');await expect.poll(()=>page.locator('canvas').getAttribute('data-camera-settled'),{timeout:12000}).toBe('true');await page.screenshot({path:path.join(output,'02-reading.png')})
 await page.getByRole('button',{name:'阅读 高数错题｜换元后别忘上下限',exact:true}).click();await expect(page.locator('.lectern-book-heading h1')).toHaveText('高数错题｜换元后别忘上下限');await page.waitForTimeout(250);await page.screenshot({path:path.join(output,'03-maths.png')})
 await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.page-heading')).toContainText('第 2 页');await page.screenshot({path:path.join(output,'04-next-page.png')})
 await page.getByRole('textbox',{name:'筛选阅读笔记',exact:true}).fill('英语');await expect.poll(()=>page.locator('.lectern-note').count()).toBeGreaterThanOrEqual(5);await page.getByRole('button',{name:'阅读 英语阅读｜长句先找主干',exact:true}).click();await expect(page.locator('.lectern-book-heading h1')).toHaveText('英语阅读｜长句先找主干');await page.screenshot({path:path.join(output,'05-english.png')})
 await page.getByRole('button',{name:'收起笔记列表',exact:true}).click();await expect(page.locator('.catalogue-collapsed')).toBeVisible();await page.screenshot({path:path.join(output,'06-focus.png')});await page.getByRole('button',{name:'展开笔记列表',exact:true}).click()
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(800,640));await page.waitForTimeout(300);await page.screenshot({path:path.join(output,'07-small-window.png')})
 await page.getByRole('button',{name:'继续编辑',exact:true}).click();await expect(page.getByRole('dialog',{name:'书与笔编辑',exact:true})).toBeVisible();await page.screenshot({path:path.join(output,'08-editor.png')});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect.poll(()=>page.locator('canvas').getAttribute('data-camera-view')).toBe('room');await expect.poll(()=>page.locator('canvas').getAttribute('data-camera-settled'),{timeout:12000}).toBe('true')
 const after=await page.evaluate(()=>window.blocknotes.call('snapshot'));expect(after.notes).toHaveLength(original.size);for(const n of after.notes)expect(fingerprint(n)).toBe(original.get(n.id));expect(errors).toEqual([])
 const result={executable:executable||electronPath,screenshots:output,notes:after.notes.length,noteFingerprintsUnchanged:after.notes.length,pageErrors:errors,source:'read-only SQLite snapshot; original application left running'}
 fs.writeFileSync('artifacts/delivery/lectern-2026-10-10/logs/visual.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
}finally{await app.close();const resolved=path.resolve(data);if(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('blocknotes-lectern-preview-'))fs.rmSync(resolved,{recursive:true,force:true})}
