// Actual public EXE, a fresh data directory, and real official downloads.
import {_electron as electron,expect} from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const {activePack,validatePack,reference}=createRequire(import.meta.url)('../server/resources.cjs')
const executable=path.resolve(process.argv[2]||'release/github-preview/win-unpacked/BlockNotes.exe')
const data=path.resolve('.local/github-publication/first-launch-'+Date.now()),logs=path.resolve('.local/github-publication/logs')
fs.mkdirSync(data,{recursive:true});fs.mkdirSync(logs,{recursive:true})
const env={...process.env,BLOCKNOTES_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.BLOCKNOTES_DEV_URL
let app,page
async function launch(){app=await electron.launch({executablePath:executable,args:[],env});page=await app.firstWindow();return page}
const start=Date.now()
try{
 await launch();await expect(page.getByRole('dialog',{name:'准备书房资源',exact:true})).toBeVisible({timeout:20000})
 await page.screenshot({path:path.join(logs,'first-launch-setup.png')})
 let previous=''
 const monitor=setInterval(async()=>{try{const phase=await page.locator('.resource-panel [role=status]').textContent({timeout:800});if(phase!==previous){previous=phase;console.log(phase)}const error=page.locator('.resource-panel [role=alert]');if(await error.count())console.log('Resource setup error: '+await error.textContent())}catch{}},3000)
 try{await page.locator('.world[data-ready=true]').waitFor({timeout:900000})}finally{clearInterval(monitor)}
 await expect(page.locator('.scene-fallback')).toHaveCount(0);await page.evaluate(()=>document.fonts.ready)
 const installed=activePack(data);expect(installed).toBeTruthy();expect(validatePack(installed)).toBe(true)
 await page.screenshot({path:path.join(logs,'first-launch-room.png')})
 await page.keyboard.press('Control+n');await expect(page.getByRole('dialog',{name:'书与笔编辑',exact:true})).toBeVisible()
 await page.locator('.tiptap').fill('全新 Windows 程序的首次运行验证：资源自动准备后，中文笔记能够可靠保存。')
 await page.getByRole('button',{name:'书名与标签…',exact:true}).click();await page.getByRole('textbox',{name:'笔记标题',exact:true}).fill('首次运行｜保存与重启验证')
 await page.keyboard.press('Control+s');await expect(page.locator('.page-footer')).toContainText('已保存到本机')
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0)
 const before=await page.evaluate(()=>window.blocknotes.call('snapshot'));await app.close();app=null
 await launch();await page.locator('.world[data-ready=true]').waitFor({timeout:20000});await expect(page.getByRole('dialog',{name:'准备书房资源',exact:true})).toHaveCount(0)
 const after=await page.evaluate(()=>window.blocknotes.call('snapshot'));expect(after.notes).toEqual(before.notes)
 const result={publicExe:executable,dataDirectory:data,resourcePack:installed,coldStart:true,autoDownload:true,ready:true,rawAndGeneratedResourceFilesMatchingDemo:reference.files.length,noteSavedAndReopened:true,secondLaunchDownloads:false,elapsedMs:Date.now()-start}
 fs.writeFileSync(path.join(logs,'first-launch.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{await app?.close()}
