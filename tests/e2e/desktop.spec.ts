import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import {mkdtempSync,rmSync,readFileSync,mkdirSync,writeFileSync,symlinkSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {createRequire} from 'node:module'
function injectSQL(dir:string,sql:string){const db=new DatabaseSync(path.join(dir,'blocknotes.sqlite'));try{db.exec('PRAGMA busy_timeout=5000');db.exec(sql)}finally{db.close()}}
import electronPath from 'electron'
let app:ElectronApplication,page:Page,dir:string,closed=false
async function launch(extraArgs:string[]=[]){const env={...process.env,BLOCKNOTES_DATA_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;app=await electron.launch({executablePath:process.env.BLOCKNOTES_TEST_EXE||electronPath as unknown as string,args:[...(process.env.BLOCKNOTES_TEST_EXE?[]:['.']),...extraArgs],env});page=await app.firstWindow();await expect(page.getByRole('button',{name:'书与笔 · 新建笔记',exact:true})).toBeEnabled();await expect(page.locator('.world')).toHaveAttribute('data-ready','true');await page.evaluate(()=>document.fonts.ready);return page}
async function metadata(){if(!await page.getByRole('textbox',{name:'笔记标题',exact:true}).count())await page.getByRole('button',{name:'书名与标签…',exact:true}).click()}
async function closePanel(){const options=await page.getByRole('dialog',{name:'书房设置',exact:true}).count();await page.keyboard.press('Escape');if(options){await expect(page.getByRole('dialog',{name:'游戏菜单',exact:true})).toBeVisible();await page.keyboard.press('Escape')}await expect(page.getByRole('dialog')).toHaveCount(0)}
async function openSettings(){await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'游戏菜单',exact:true})).toBeVisible();await page.getByRole('button',{name:'选项…',exact:true}).click();await expect(page.getByRole('dialog',{name:'书房设置',exact:true})).toBeVisible()}
async function clickEntity(label:string,positions:number[][],dialog:string){const size=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));for(const p of positions){await page.mouse.move(size.width*p[0],size.height*p[1]);await page.waitForTimeout(220);const hover=page.locator('.hover-label');if(await hover.count()&&(await hover.innerText()).includes(label)){await page.mouse.click(size.width*p[0],size.height*p[1]);await expect(page.getByRole('dialog',{name:dialog,exact:true})).toBeVisible();return}}throw new Error('未能通过 3D 实体点击打开 '+label)}
test.beforeEach(()=>{closed=false;dir=mkdtempSync(path.join(tmpdir(),'blocknotes-e2e-'));mkdirSync('test-results',{recursive:true});if(process.env.BLOCKNOTES_TEST_RESOURCE_PACK){const {validatePack,recipe}=createRequire(import.meta.url)('../../server/resources.cjs'),root=path.resolve(process.env.BLOCKNOTES_TEST_RESOURCE_PACK);if(!validatePack(root))throw new Error('E2E 本地资源未通过演示基准校验');const packs=path.join(dir,'resource-packs');mkdirSync(packs);symlinkSync(root,path.join(packs,'minecraft-1.21-test'),'junction');writeFileSync(path.join(packs,'active.json'),JSON.stringify({recipe,directory:'minecraft-1.21-test'}))}})
test.afterEach(async()=>{if(app&&!closed)await app.close();const resolved=path.resolve(dir);if(resolved.startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(resolved).startsWith('blocknotes-e2e-'))rmSync(resolved,{recursive:true,force:true})})

test('新增书架可删除：同名空分类、取消与 Esc、迁移全部状态后重启',async()=>{
 const {openStore}=createRequire(import.meta.url)('../../server/storage.cjs'),store=openStore(dir,{dailyBackup:false})
 store.run('shelf',{id:'custom-filled',name:'待合并分类'});const original=[]
 for(const status of ['active','archived','deleted']){let n=store.run('create',{title:status+'保留',shelfId:'custom-filled',doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'正文必须完整保留 '+status}]}]}});if(status!=='active')n=store.run('location',{id:n.id,revision:n.revision,status});original.push(n)}store.close();await launch()
 await page.keyboard.press('4');await page.getByRole('button',{name:'管理书架',exact:true}).click();await expect(page.getByRole('button',{name:'删除分类…',exact:true})).toHaveCount(0)
 await page.getByRole('textbox',{name:'书架名称',exact:true}).fill('同名分类');await page.getByRole('button',{name:'新增分类',exact:true}).click();await page.getByRole('button',{name:'管理书架',exact:true}).click();await page.getByRole('button',{name:'新增分类',exact:true}).click()
 await page.getByRole('button',{name:'管理书架',exact:true}).click();await page.getByRole('button',{name:'删除分类…',exact:true}).click();const confirm=page.getByRole('alertdialog',{name:'删除书架分类',exact:true});await expect(confirm).toBeVisible();await expect(confirm).toContainText('空书架');await expect(page.getByRole('combobox',{name:'接收笔记的书架',exact:true})).toHaveCount(0)
 await page.keyboard.press('Escape');await expect(confirm).toHaveCount(0);await expect(page.getByRole('dialog',{name:'书架管理',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'删除分类…',exact:true}).click();await page.getByRole('button',{name:'保留分类',exact:true}).click();await page.getByRole('button',{name:'删除分类…',exact:true}).click();await page.getByRole('button',{name:'删除空分类',exact:true}).click();await expect(confirm).toHaveCount(0);await expect(page.locator('.shelf-tabs button').filter({hasText:'同名分类'})).toHaveCount(1)
 await page.locator('.shelf-tabs button').filter({hasText:'待合并分类'}).click();await page.getByRole('button',{name:'管理书架',exact:true}).click();await page.getByRole('button',{name:'删除分类…',exact:true}).click();await expect(confirm).toContainText('3 本笔记');await expect(page.getByRole('button',{name:'移动笔记并删除分类',exact:true})).toBeDisabled()
 await page.keyboard.press('Control+n');await expect(confirm).toBeVisible();await expect(page.getByRole('dialog',{name:'书与笔编辑',exact:true})).toHaveCount(0)
 await page.getByRole('combobox',{name:'接收笔记的书架',exact:true}).selectOption('ideas');await page.screenshot({path:'test-results/shelf-delete-confirmation.png'});await page.getByRole('button',{name:'移动笔记并删除分类',exact:true}).click();await expect(confirm).toHaveCount(0);await expect(page.locator('.shelf-tabs button').filter({hasText:'待合并分类'})).toHaveCount(0)
 const check=async()=>{const snapshot=await page.evaluate(()=>(window as any).blocknotes.call('snapshot'));expect(snapshot.notes).toHaveLength(3);for(const n of original){const saved=snapshot.notes.find((v:any)=>v.id===n.id);expect(saved.doc).toEqual(n.doc);expect(saved.status).toBe(n.status);expect(saved.previousStatus).toBe(n.previousStatus);expect(saved.shelfId).toBe('ideas');expect(saved.revision).toBe(n.revision+1)}return snapshot}
 await check();await closePanel();await app.close();closed=true;await launch();closed=false;await check();await page.keyboard.press('6');await expect(page.getByRole('button',{name:'archived保留',exact:true})).toBeVisible();await page.getByRole('button',{name:/回收区/}).click();await expect(page.getByRole('button',{name:'恢复笔记',exact:true})).toBeVisible();await page.getByRole('button',{name:'恢复笔记',exact:true}).click();await closePanel();await page.keyboard.press('4');await page.locator('.shelf-tabs button').filter({hasText:'灵感书架'}).click();await expect(page.getByRole('button',{name:'deleted保留',exact:true})).toBeVisible()
})

test('讲台分页只读：翻页与窗口重排不产生保存或笔记版本变更',async()=>{
 const {openStore}=createRequire(import.meta.url)('../../server/storage.cjs'),store=openStore(dir,{dailyBackup:false})
 const n=store.run('create',{title:'只读分页笔记',doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'只读第一页'}]},{type:'bookPageBreak'},{type:'paragraph',content:[{type:'text',text:'只读第二页'}]}]}})
 store.run('settings',{key:'lastNoteId',value:n.id});store.close();await launch()
 await page.keyboard.press('5');await expect(page.getByRole('dialog',{name:'讲台阅读',exact:true})).toBeVisible();await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false')
 await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.page-heading')).toContainText('第 2 页')
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,740))
 await page.getByRole('button',{name:'上一页',exact:true}).click();await expect(page.locator('.page-heading')).toContainText('第 1 页');await closePanel()
 const snapshot=await page.evaluate(()=>(window as any).blocknotes.call('snapshot')),saved=snapshot.notes.find((note:any)=>note.id===n.id)
 expect(saved.revision).toBe(n.revision);expect(saved.doc).toEqual(n.doc);expect(saved.updatedAt).toBe(n.updatedAt)
 expect(await page.evaluate(()=>localStorage.getItem('blocknotes.pending.v1'))).toBeNull()
})

test('独立讲台工作台：选书筛选、固定镜头、末页只读、收起列表与返回编辑',async()=>{
 const {openStore}=createRequire(import.meta.url)('../../server/storage.cjs'),store=openStore(dir,{dailyBackup:false})
 const doc=(a:string,b:string)=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:a}]},{type:'bookPageBreak'},{type:'paragraph',content:[{type:'text',text:b}]}]})
 const maths=store.run('create',{title:'高数错题',doc:doc('换元第一步','新上下限第二页'),shelfId:'main',tags:['数学']}),english=store.run('create',{title:'英语精读',doc:doc('English reading','Long sentence analysis'),shelfId:'ideas',tags:['长难句']}),archived=store.run('create',{title:'已完成的课程复盘',doc:doc('课程记录','结课复盘')}),deleted=store.run('create',{title:'不应出现在讲台'})
 store.run('location',{id:archived.id,revision:archived.revision,status:'archived'});store.run('location',{id:deleted.id,revision:deleted.revision,status:'deleted'});store.run('settings',{key:'lastNoteId',value:maths.id});const original=store.run('snapshot');store.close();await launch()
 await page.keyboard.press('5');await expect(page.locator('.lectern-dialog')).toBeVisible();await expect(page.getByRole('dialog',{name:'书与笔编辑',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'保存',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'书名与标签…',exact:true})).toHaveCount(0)
 await expect(page.locator('.lectern-note')).toHaveCount(3);await expect(page.getByRole('button',{name:'阅读 高数错题',exact:true})).toHaveAttribute('aria-current','true')
 await expect.poll(()=>page.locator('canvas').getAttribute('data-camera-view')).toBe('lectern');await expect.poll(()=>page.locator('canvas').getAttribute('data-camera-settled'),{timeout:12000}).toBe('true')
 const position=await page.locator('canvas').getAttribute('data-camera-position');await page.mouse.move(50,50);await page.waitForTimeout(180);expect(await page.locator('canvas').getAttribute('data-camera-position')).toBe(position)
 await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.page-heading')).toContainText('第 2 页');await expect(page.locator('.page-forward')).toBeDisabled()
 await page.getByRole('textbox',{name:'筛选阅读笔记',exact:true}).fill('长难句');await expect(page.locator('.lectern-note')).toHaveCount(1);await page.getByRole('button',{name:'阅读 英语精读',exact:true}).click();await expect(page.locator('.lectern-book-heading h1')).toHaveText('英语精读');await expect(page.locator('.page-heading')).toContainText('第 1 页');await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false')
 await page.getByRole('textbox',{name:'筛选阅读笔记',exact:true}).fill('');await page.getByRole('combobox',{name:'阅读书架分类',exact:true}).selectOption('archived');await expect(page.locator('.lectern-note')).toHaveCount(1);await page.getByRole('button',{name:'阅读 已完成的课程复盘',exact:true}).click();await expect(page.locator('.tiptap')).toContainText('课程记录')
 await page.getByRole('button',{name:'收起笔记列表',exact:true}).click();await expect(page.getByRole('complementary',{name:'讲台笔记列表',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'展开笔记列表',exact:true})).toBeVisible();await page.getByRole('button',{name:'展开笔记列表',exact:true}).click()
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(800,640));await page.waitForTimeout(200)
 const dimensions=await page.evaluate(()=>{const root=document.querySelector('.lectern-dialog')!.getBoundingClientRect(),book=document.querySelector('.book-page')!.getBoundingClientRect(),controls=document.querySelector('.lectern-controls')!.getBoundingClientRect();return{right:root.right,bottom:controls.bottom,bookRight:book.right,width:innerWidth,height:innerHeight}})
 expect(dimensions.right).toBeLessThanOrEqual(dimensions.width);expect(dimensions.bookRight).toBeLessThanOrEqual(dimensions.width);expect(dimensions.bottom).toBeLessThan(dimensions.height-40)
 await page.screenshot({path:'test-results/lectern-workbench-small.png'})
 const snapshot=await page.evaluate(()=>(window as any).blocknotes.call('snapshot'));for(const n of original.notes){const saved=snapshot.notes.find((v:any)=>v.id===n.id);expect(saved.doc).toEqual(n.doc);expect(saved.revision).toBe(n.revision)}
 await page.getByRole('button',{name:'继续编辑',exact:true}).click();await expect(page.getByRole('dialog',{name:'书与笔编辑',exact:true})).toBeVisible();await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','true');await page.waitForTimeout(650)
 const unedited=await page.evaluate(()=>(window as any).blocknotes.call('snapshot'));expect(unedited.notes.find((v:any)=>v.id===archived.id).revision).toBe(original.notes.find((v:any)=>v.id===archived.id).revision)
 await page.locator('.tiptap').fill('归档阅读后继续编辑，原有保存仍可靠');await page.keyboard.press('Control+s');await expect(page.locator('.page-footer')).toContainText('已保存到本机');await closePanel()
 await expect.poll(()=>page.locator('canvas').getAttribute('data-camera-view')).toBe('room');await expect.poll(()=>page.locator('canvas').getAttribute('data-camera-settled'),{timeout:12000}).toBe('true')
 await app.close();closed=true;await launch();closed=false;await page.keyboard.press('5');await expect(page.locator('.lectern-book-heading h1')).toHaveText('已完成的课程复盘');await expect(page.locator('.tiptap')).toContainText('归档阅读后继续编辑')
})

test('空讲台不创建笔记，无匹配筛选与仅归档书籍仍可阅读',async()=>{
 await launch();await page.keyboard.press('5');await expect(page.getByRole('dialog',{name:'讲台阅读',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'继续编辑',exact:true})).toBeDisabled();await expect(page.locator('.lectern-empty-book')).toContainText('从左侧选择一本笔记');await closePanel()
 const {openStore}=createRequire(import.meta.url)('../../server/storage.cjs');await app.close();closed=true;const store=openStore(dir,{dailyBackup:false});expect(store.run('snapshot').notes).toHaveLength(0)
 const n=store.run('create',{title:'唯一的归档笔记',doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'归档也能放到讲台阅读'}]}]}});store.run('location',{id:n.id,revision:n.revision,status:'archived'});store.close();await launch();closed=false;await page.keyboard.press('5');await expect(page.locator('.tiptap')).toContainText('归档也能放到讲台阅读');await page.getByRole('textbox',{name:'筛选阅读笔记',exact:true}).fill('不存在的关键词');await expect(page.locator('.lectern-list-empty')).toContainText('没有匹配');await expect(page.locator('.tiptap')).toContainText('归档也能放到讲台阅读')
})

test('BN-P1-02：自产 72 MB 旧格式备份通过真实文件 IPC 恢复并再次导入不增加',async()=>{
 test.setTimeout(180000)
 const {openStore}=createRequire(import.meta.url)('../../server/storage.cjs'),store=openStore(dir,{dailyBackup:false})
 const text='备'.repeat(750000),expected:Record<string,string>={}
 for(let i=0;i<16;i++){const n=store.run('create',{title:`大备份 ${i}`,doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:text+i}]}]},tags:['兼容旧备份'],shelfId:i%2?'ideas':'main'});expected[n.id]=createHash('sha256').update(JSON.stringify(n.doc)).digest('hex')}
 store.close();await launch();const file=path.join(dir,'large-v1-backup.json')
 await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},file)
 await openSettings();await page.getByRole('button',{name:'导出备份',exact:true}).click();await expect(page.getByRole('status')).toContainText('完整备份已导出',{timeout:60000})
 expect(readFileSync(file).length).toBeGreaterThan(64_000_000)
 await app.close();closed=true;const clean=openStore(dir,{dailyBackup:false});clean.db.exec('DELETE FROM notes');clean.close()
 await launch();closed=false;await openSettings()
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});(globalThis as any).__restoreHeartbeat=0;(globalThis as any).__restoreMaxGap=0;let last=Date.now();setInterval(()=>{const now=Date.now();(globalThis as any).__restoreMaxGap=Math.max((globalThis as any).__restoreMaxGap,now-last);last=now;(globalThis as any).__restoreHeartbeat++},20)},file)
 const start=Date.now();await page.getByRole('button',{name:'选择备份并合并',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('新增 16 本',{timeout:60000})
 expect(await app.evaluate(()=>(globalThis as any).__restoreHeartbeat)).toBeGreaterThan(5)
 expect(await app.evaluate(()=>(globalThis as any).__restoreMaxGap)).toBeLessThan(3000)
 await page.screenshot({path:'test-results/p1-large-backup-restored.png'})
 await page.getByRole('button',{name:'选择备份并合并',exact:true}).click();await expect(page.getByRole('status')).toContainText('新增 0 本',{timeout:60000})
 const db=new DatabaseSync(path.join(dir,'blocknotes.sqlite'));try{const rows=db.prepare('SELECT id,doc FROM notes').all();expect(rows).toHaveLength(16);for(const row of rows)expect(createHash('sha256').update(row.doc as string).digest('hex')).toBe(expected[row.id as string])}finally{db.close()}
 writeFileSync('test-results/p1-large-backup-metrics.json',JSON.stringify({bytes:readFileSync(file).length,notes:16,elapsedMs:Date.now()-start,mainHeartbeat:await app.evaluate(()=>(globalThis as any).__restoreHeartbeat),mainMaxGapMs:await app.evaluate(()=>(globalThis as any).__restoreMaxGap)},null,2))
})

test('BN-P1-03：Esc 在归档等待中不被迟到的容器重新打开，长文保存和连续按键可靠',async()=>{
 test.setTimeout(120000);await launch()
 await app.evaluate(({ipcMain})=>{const handlers=(ipcMain as any)._invokeHandlers,original=handlers.get('blocknotes:command');(globalThis as any).__closeTrace=[];handlers.set('blocknotes:command',async(e:any,op:string,input:any)=>{const started=Date.now();if(op==='save'||op==='location')await new Promise(r=>setTimeout(r,250));try{return await original(e,op,input)}finally{(globalThis as any).__closeTrace.push({op,started,ended:Date.now()})}})})
 const cycles:{cycle:number;elapsedMs:number;dialogs:number}[]=[]
 for(let i=0;i<12;i++){
  await page.keyboard.press('Control+n');await expect(page.getByRole('dialog',{name:'书与笔编辑'})).toBeVisible()
  await page.locator('.tiptap').fill('关闭回归长正文，自动保存与快捷键。'.repeat(i%3===0?1000:10)+i)
  await metadata();await page.getByRole('textbox',{name:'笔记标题',exact:true}).fill(`关闭回归 ${i}`)
  const started=Date.now()
  if(i%3===0){await page.getByRole('button',{name:'收进归档箱',exact:true}).click();await page.keyboard.press('Escape')}
  else if(i%3===1){await page.getByRole('combobox',{name:'所在书架'}).selectOption('ideas');await page.keyboard.press('Escape')}
  else{await page.keyboard.down('Escape');await page.keyboard.down('Escape');await page.keyboard.up('Escape')}
  await page.waitForTimeout(800);await expect(page.getByRole('dialog')).toHaveCount(0)
  cycles.push({cycle:i,elapsedMs:Date.now()-started,dialogs:await page.getByRole('dialog').count()})
 }
 const metrics=JSON.stringify({cycles,ipcTrace:await app.evaluate(()=>(globalThis as any).__closeTrace)},null,2)
 writeFileSync(`test-results/p1-close-loop-metrics-${test.info().repeatEachIndex}.json`,metrics);await test.info().attach('close-loop-metrics',{body:Buffer.from(metrics),contentType:'application/json'})
 await app.close();closed=true;await launch();closed=false
 const db=new DatabaseSync(path.join(dir,'blocknotes.sqlite'));try{const rows=db.prepare('SELECT title,plain FROM notes').all();expect(rows).toHaveLength(12);for(let i=0;i<12;i++){const row=rows.find(r=>r.title===`关闭回归 ${i}`);expect(row?.plain).toContain('关闭回归长正文');expect(row?.plain).toContain(String(i))}}finally{db.close()}
 await page.screenshot({path:'test-results/p1-close-loop-room.png'})
})

test('BN-P1-03：Esc 保存失败保持编辑器和草稿，修复写入后才关闭',async()=>{
 await launch();await page.keyboard.press('Control+n');await expect(page.getByRole('dialog',{name:'书与笔编辑'})).toBeVisible()
 await page.locator('.tiptap').fill('已保存原文');await page.keyboard.press('Control+s');await expect(page.locator('.page-footer')).toContainText('已保存到本机')
 injectSQL(dir,"CREATE TRIGGER close_fail_save BEFORE UPDATE ON notes BEGIN SELECT RAISE(ABORT,'关闭测试：写入失败'); END;")
 await page.locator('.tiptap').fill('不能丢失的关闭失败草稿');await page.keyboard.press('Escape');await expect(page.getByRole('alert')).toContainText('写入失败');await expect(page.getByRole('dialog',{name:'书与笔编辑'})).toBeVisible();await expect(page.locator('.page-footer')).toContainText('保存失败')
 expect(await page.evaluate(()=>localStorage.getItem('blocknotes.pending.v1'))).toContain('不能丢失的关闭失败草稿')
 injectSQL(dir,'DROP TRIGGER close_fail_save');await closePanel();await app.close();closed=true;await launch();closed=false;await page.keyboard.press('4');await page.locator('.note-open').click();await expect(page.locator('.tiptap')).toContainText('不能丢失的关闭失败草稿')
})
test('桌面完整笔记闭环、四个真实场景实体、备份与尺寸适配',async()=>{
 await launch();await expect(page.locator('.room-header,.room-footer,.item-name')).toHaveCount(0);await expect(page.getByRole('button',{name:'书房设置',exact:true})).toHaveCount(0);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.mouse.move(20,20);await page.waitForTimeout(600);await expect(page.locator('canvas')).toBeVisible();await page.screenshot({path:'test-results/01-room.png'})
 for(const name of ['shelf','lectern','chest'])await expect.poll(()=>page.locator(`.hotbar [data-item="${name}"] img`).evaluate((img:HTMLImageElement)=>img.complete?img.naturalWidth:0)).toBe(48)
 for(const name of ['quill','tag','compass'])expect(await page.locator(`.hotbar [data-item="${name}"] img`).evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(16)
 await page.getByRole('button',{name:'书与笔 · 新建笔记',exact:true}).click();await expect(page.getByRole('dialog',{name:'书与笔编辑'})).toBeVisible();await metadata();await page.getByRole('textbox',{name:'笔记标题',exact:true}).fill('书房里的第一本中文笔记');let body=page.locator('.tiptap');await body.fill('今天在书房记录知识库。中文输入，完整正文与 Minecraft / TypeScript & 特殊符号 < > % _ 😀。');await page.getByRole('textbox',{name:'添加标签'}).fill('知识管理');await page.getByRole('textbox',{name:'添加标签'}).press('Enter');await page.keyboard.press('Control+s');await expect(page.locator('.page-footer')).toContainText('已保存到本机');await page.getByRole('combobox',{name:'所在书架'}).selectOption('ideas');await expect(page.getByRole('combobox',{name:'所在书架'})).toHaveValue('ideas');await page.getByRole('button',{name:'收起',exact:true}).click();await page.screenshot({path:'test-results/02-editor.png'})
 // Mouse motion changes the room and pauses while a book is open.
 const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');const clip={x:20,y:100,width:150,height:150};await page.waitForTimeout(150);const paused1=await page.screenshot({clip});await page.mouse.move(1100,680);await page.waitForTimeout(250);expect(digest(await page.screenshot({clip}))).toBe(digest(paused1));await closePanel();await page.mouse.move(20,150);await page.waitForTimeout(600);const motion1=await page.screenshot({clip});await page.mouse.move(1200,500);await page.waitForTimeout(600);expect(digest(await page.screenshot({clip}))).not.toBe(digest(motion1))
 await app.close();await launch();await page.keyboard.press('4');await expect(page.getByRole('dialog',{name:'书架管理'})).toBeVisible();await page.locator('.shelf-tabs button').filter({hasText:'灵感书架'}).click();await page.getByRole('button',{name:'书房里的第一本中文笔记',exact:true}).click();await expect(page.locator('.tiptap')).toContainText('完整正文');await metadata();await expect(page.getByRole('textbox',{name:'笔记标题',exact:true})).toHaveValue('书房里的第一本中文笔记');await expect(page.getByRole('combobox',{name:'所在书架'})).toHaveValue('ideas')
 body=page.locator('.tiptap');await body.press('Control+End');await page.keyboard.insertText('追加文字');await expect(body).toContainText('追加文字');await page.getByRole('button',{name:'格式…',exact:true}).click();await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(body).not.toContainText('追加文字');await page.getByRole('button',{name:'重做',exact:true}).click();await expect(body).toContainText('追加文字');await page.keyboard.press('Control+s');await closePanel()
 await page.keyboard.press('Control+k');await expect(page.getByRole('dialog',{name:'指南针搜索'})).toBeVisible();for(const q of ['知','知识','知识库','知识管理','TypeScript']){await page.getByRole('textbox',{name:'搜索笔记',exact:true}).fill(q);await expect(page.locator('.note-slot')).toHaveCount(1)}await page.getByRole('textbox',{name:'搜索笔记',exact:true}).fill('不存在的文字');await expect(page.getByText('没有找到这段文字')).toBeVisible();await page.getByRole('textbox',{name:'搜索笔记',exact:true}).fill('知识库');await expect(page.locator('.note-slot')).toHaveCount(1);await page.screenshot({path:'test-results/03-search.png'});await page.locator('.note-open').click();await expect(page.getByRole('dialog',{name:'讲台阅读'})).toBeVisible();await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable','false');await page.getByRole('button',{name:'继续编辑',exact:true}).click();await metadata();await page.getByRole('textbox',{name:'笔记标题',exact:true}).fill('重新命名的书');await page.getByRole('button',{name:'收进归档箱',exact:true}).click();await expect(page.getByRole('dialog',{name:'归档箱'})).toBeVisible();await expect(page.locator('.note-slot')).toHaveCount(1);await page.getByRole('button',{name:'放回书架',exact:true}).click();await expect(page.locator('.note-slot')).toHaveCount(0)
 await closePanel();await page.keyboard.press('4');await expect(page.getByRole('dialog',{name:'书架管理'})).toBeVisible();await page.getByRole('button',{name:'重新命名的书',exact:true}).click();await metadata();await page.getByRole('button',{name:'移入回收区…',exact:true}).click();await page.getByRole('button',{name:'移入回收区',exact:true}).click();await expect(page.getByRole('button',{name:'恢复笔记',exact:true})).toBeVisible();await page.getByRole('button',{name:'恢复笔记',exact:true}).click();await expect(page.locator('.note-slot')).toHaveCount(0)
 const backupPath=path.join(dir,'manual-backup.json'),markdownPath=path.join(dir,'note.md');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},backupPath);await closePanel();await openSettings();await page.getByRole('button',{name:'导出备份',exact:true}).click();await expect(page.getByRole('status')).toContainText('完整备份已导出');const backup=JSON.parse(readFileSync(backupPath,'utf8'));expect(backup.notes).toHaveLength(1);expect(backup.notes[0].shelfId).toBe('ideas');expect(backup.notes[0].tags).toContain('知识管理');await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},backupPath);await page.getByRole('button',{name:'选择备份并合并',exact:true}).click();await expect(page.getByRole('status')).toContainText('新增 0 本');await closePanel();await page.keyboard.press('4');await expect(page.getByRole('dialog',{name:'书架管理'})).toBeVisible();await page.getByRole('button',{name:'重新命名的书',exact:true}).click();await metadata();await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},markdownPath);await page.getByRole('button',{name:'导出 Markdown',exact:true}).click();await expect(page.getByRole('status')).toContainText('Markdown 已导出');expect(readFileSync(markdownPath,'utf8')).toContain('完整正文');await closePanel()
 await clickEntity('知识书架',[[.34,.44],[.32,.40],[.40,.50]],'书架管理');await closePanel();await clickEntity('灵感书架',[[.77,.40],[.76,.35],[.81,.45]],'书架管理');await closePanel();await clickEntity('讲台',[[.34,.75],[.34,.72],[.33,.77]],'讲台阅读');await closePanel();await clickEntity('箱子',[[.17,.65],[.18,.64],[.16,.67]],'归档箱');await closePanel()
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(800,640));await page.waitForTimeout(300);for(const name of ['shelf','lectern','chest'])await expect.poll(()=>page.locator(`.hotbar [data-item="${name}"] img`).evaluate((img:HTMLImageElement)=>img.complete?img.naturalWidth:0)).toBe(32);await page.keyboard.press('1');await expect(page.getByRole('dialog',{name:'书与笔编辑'})).toBeVisible();await metadata();await page.screenshot({path:'test-results/04-small-window.png'});const meta=await page.locator('.book-meta').boundingBox(),book=await page.locator('.book-workspace').boundingBox();expect(meta!.height).toBeLessThanOrEqual(book!.height+5);expect(errors).toEqual([])
})
test('20 本样例、长文翻页、保存失败提示与未完成草稿恢复',async()=>{
 await launch();for(let i=0;i<20;i++){await page.keyboard.press('Control+n');await expect(page.getByRole('dialog',{name:'书与笔编辑'})).toBeVisible();await metadata();await page.getByRole('textbox',{name:'笔记标题',exact:true}).fill(i===19?'很长的书名与中英文混合标题'.repeat(18):`样例 ${i} / 中文 & English`);if(i!==0)await page.locator('.tiptap').fill(i===19?('这是长文的第一个想法。知识库与记忆需要慢慢整理。\n'.repeat(120)+'长文尾部标记'):('中英文知识库，特殊符号 <>&_% 😀 第 '+i+' 本'));await page.getByRole('combobox',{name:'所在书架'}).selectOption(i%2?'ideas':'main');await page.keyboard.press('Control+s');await expect(page.locator('.page-footer')).toContainText('已保存到本机');if(i<19)await closePanel()}
 await page.getByRole('button',{name:'收起',exact:true}).click();await page.locator('.tiptap').press('Control+Home');await expect(page.locator('.page-heading')).toContainText('第 1 页');await expect(page.locator('.page-heading')).not.toHaveText('第 1 页，共 1 页');await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.page-heading')).toContainText('第 2 页');await page.getByRole('button',{name:'上一页',exact:true}).click();await expect(page.locator('.page-heading')).toContainText('第 1 页');await page.screenshot({path:'test-results/05-pagination.png'});await closePanel();await page.keyboard.press('4');await expect(page.getByRole('dialog',{name:'书架管理'})).toBeVisible();await expect(page.locator('.note-slot')).toHaveCount(10);await page.locator('.shelf-tabs button').filter({hasText:'知识书架'}).click();await expect(page.locator('.note-slot')).toHaveCount(10);await closePanel();await page.keyboard.press('Control+k');await expect(page.getByRole('dialog',{name:'指南针搜索'})).toBeVisible();await page.getByRole('textbox',{name:'搜索笔记'}).fill('知识库');await expect(page.locator('.note-slot')).toHaveCount(19);await closePanel()
 // SQLite failure injection beneath the real save path verifies that unsaved text is not acknowledged.
 await page.keyboard.press('Control+n');await expect(page.getByRole('dialog',{name:'书与笔编辑'})).toBeVisible();injectSQL(dir,"CREATE TRIGGER test_fail_save BEFORE UPDATE ON notes BEGIN SELECT RAISE(ABORT,'测试：磁盘写入失败'); END;");await page.locator('.tiptap').fill('这段未完成草稿必须保留');await expect(page.getByRole('alert')).toContainText('磁盘写入失败');await expect(page.locator('.page-footer')).toContainText('保存失败');await page.screenshot({path:'test-results/06-save-error.png'});const cache=await page.evaluate(()=>localStorage.getItem('blocknotes.pending.v1'));expect(cache).toContain('未完成草稿');injectSQL(dir,'DROP TRIGGER test_fail_save');await app.evaluate(({app})=>app.exit(0));await launch();await page.keyboard.press('4');await expect(page.getByRole('dialog',{name:'书架管理'})).toBeVisible();await expect(page.getByRole('button',{name:'未命名笔记（恢复草稿）',exact:true})).toBeVisible();await page.getByRole('button',{name:'未命名笔记（恢复草稿）',exact:true}).click();await expect(page.locator('.tiptap')).toContainText('这段未完成草稿必须保留')
})

test('图形初始化失败仍可保存笔记，恢复图形后重新打开',async()=>{
 await launch();await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind:any,...args:any[]):any{if(kind==='webgl'||kind==='webgl2'||kind==='experimental-webgl')return null;return original.apply(this,[kind,...args] as any)}});await page.reload();await expect(page.locator('.scene-fallback')).toContainText('3D 渲染不可用');await expect(page.locator('.loading')).toHaveCount(0)
 await page.getByRole('button',{name:'书与笔 · 新建笔记',exact:true}).click();await expect(page.getByRole('dialog',{name:'书与笔编辑'})).toBeVisible();await page.locator('.tiptap').fill('图形初始化失败时，这篇中文笔记仍能保存。');await page.keyboard.press('Control+s');await expect(page.locator('.page-footer')).toContainText('已保存到本机');await closePanel();await app.close()
 await launch();await expect(page.locator('.scene-fallback')).toHaveCount(0);await page.keyboard.press('4');await expect(page.getByRole('dialog',{name:'书架管理'})).toBeVisible();await page.getByRole('button',{name:'未命名笔记',exact:true}).click();await expect(page.locator('.tiptap')).toContainText('这篇中文笔记仍能保存')
})

test('原始 OGG 解码与真实交互播放、音高音量、静音持久化',async()=>{
 await launch()
 const definitions=JSON.parse(readFileSync('public/minecraft/sounds/manifest.json','utf8').replace(/^\uFEFF/,''))
 for(const [name,asset] of Object.entries(definitions.sources) as [string,{sha1:string}][]){expect(createHash('sha1').update(readFileSync('public/minecraft/sounds/'+name+'.ogg')).digest('hex')).toBe(asset.sha1)}
 const expected=await page.evaluate(async definitions=>{
  const fingerprint=(buffer:AudioBuffer)=>{let sum=0;const data=buffer.getChannelData(0);for(let i=0;i<Math.min(4096,data.length);i++)sum+=data[i]*(i+1);return buffer.length+':'+Math.round(sum*1000000)}
  const ctx=new AudioContext(),files:Record<string,string>={}
  for(const name of Object.keys(definitions.sources)){const response=await fetch('minecraft/sounds/'+name+'.ogg');files[name]=fingerprint(await ctx.decodeAudioData(await response.arrayBuffer()))}await ctx.close()
  const result:Record<string,string[]>={};for(const [event,definition] of Object.entries(definitions.events) as [string,{sounds:any[]}][])result[event]=definition.sounds.map(sample=>files[typeof sample==='string'?sample:sample.name])
  ;(window as any).__playedAudio=[]
  const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(destination:any,...rest:any[]):any{if(this instanceof AudioBufferSourceNode&&destination instanceof GainNode)(this as any).__gain=destination.gain;return connect.apply(this,[destination,...rest] as any)}
  const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args:any[]){if(this.buffer)(window as any).__playedAudio.push({fingerprint:fingerprint(this.buffer),volume:(this as any).__gain?.value,rate:this.playbackRate.value});return start.apply(this,args as any)}
  return result
 },definitions)
 const played=async(event:string)=>page.evaluate(ids=>(window as any).__playedAudio.filter((entry:any)=>ids.includes(entry.fingerprint)),expected[event])
 await clickEntity('箱子',[[.17,.65],[.18,.64],[.16,.67]],'归档箱');await expect.poll(()=>played('block.chest.open')).toHaveLength(1);const chest=(await played('block.chest.open'))[0];expect(chest.volume).toBeCloseTo(.5);expect(chest.rate).toBeGreaterThanOrEqual(.9);expect(chest.rate).toBeLessThanOrEqual(1)
 await closePanel();await expect.poll(()=>played('block.chest.close')).toHaveLength(1)
 await page.keyboard.press('Control+n');await expect(page.getByRole('dialog',{name:'书与笔编辑'})).toBeVisible();await expect.poll(()=>played('item.book.page_turn')).toHaveLength(1);await page.locator('.tiptap').fill('原始音效与本地笔记。\n'.repeat(40));await page.locator('.tiptap').press('Control+Home');await page.getByRole('button',{name:'下一页',exact:true}).click();await expect.poll(()=>played('item.book.page_turn')).toHaveLength(2);expect((await played('item.book.page_turn'))[1].volume).toBeCloseTo(.5)
 await page.getByRole('button',{name:'书名与标签…',exact:true}).click();await expect.poll(()=>played('ui.button.click')).toHaveLength(1);expect((await played('ui.button.click'))[0].volume).toBeCloseTo(.25);await page.getByRole('combobox',{name:'所在书架'}).selectOption('ideas');await expect.poll(()=>played('block.chiseled_bookshelf.insert')).toHaveLength(1);expect((await played('block.chiseled_bookshelf.insert'))[0].volume).toBeCloseTo(.8)
 await closePanel();await expect.poll(()=>played('item.book.put')).toHaveLength(1);await clickEntity('知识书架',[[.34,.44],[.32,.40],[.40,.50]],'书架管理');await expect.poll(()=>played('block.chiseled_bookshelf.pickup')).toHaveLength(1);await closePanel()
 await openSettings();const slider=page.getByRole('slider',{name:'音效音量',exact:true});await slider.press('Home');await expect(slider).toHaveValue('0');await page.waitForTimeout(200);const count=await page.evaluate(()=>(window as any).__playedAudio.length);await closePanel();await page.keyboard.press('Control+n');await expect(page.getByRole('dialog',{name:'书与笔编辑'})).toBeVisible();await page.getByRole('button',{name:'书名与标签…',exact:true}).click();await page.waitForTimeout(300);expect(await page.evaluate(()=>(window as any).__playedAudio.length)).toBe(count);await closePanel();await app.close()
 await launch();await openSettings();await expect(page.getByRole('slider',{name:'音效音量',exact:true})).toHaveValue('0')
})


test('暂停菜单冻结场景、选项与指引返回、工具提示、空白页持久化和安全退出',async()=>{
 await launch()
 const tool=page.getByRole('button',{name:'书与笔 · 新建笔记',exact:true})
 await tool.hover();await expect(page.getByRole('tooltip')).toContainText('新建笔记',{timeout:500})
 await page.mouse.move(20,20);await expect(page.getByRole('tooltip')).toHaveCount(0)
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'游戏菜单',exact:true})).toBeVisible()
 const clip={x:20,y:100,width:150,height:150},digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex')
 await page.waitForTimeout(200);const before=digest(await page.screenshot({clip}));await page.mouse.move(1200,500);await page.waitForTimeout(300);expect(digest(await page.screenshot({clip}))).toBe(before)
 await page.keyboard.press('1');await page.keyboard.press('Control+n');await expect(page.getByRole('dialog',{name:'游戏菜单',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'选项…',exact:true}).click();await expect(page.getByRole('dialog',{name:'书房设置',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'游戏菜单',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'操作指引…',exact:true}).click();await expect(page.getByRole('dialog',{name:'操作指引',exact:true})).toContainText('Ctrl + S');await page.getByRole('button',{name:'完成',exact:true}).click();await expect(page.getByRole('dialog',{name:'游戏菜单',exact:true})).toBeVisible()
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0)
 await tool.click();await expect(page.locator('.page-heading')).toHaveText('第 1 页，共 1 页')
 await page.locator('.tiptap').fill('第一页正文保留。')
 await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.page-heading')).toHaveText('第 2 页，共 2 页')
 await page.keyboard.insertText('第二页正文独立。');await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.page-heading')).toHaveText('第 3 页，共 3 页')
 const blank=await page.evaluate(()=>{const box=document.querySelector('.page-scroll')!,last=document.querySelector('.tiptap')!.lastElementChild!,a=box.getBoundingClientRect(),b=last.getBoundingClientRect();return {text:last.textContent,top:b.top-a.top}})
 expect(blank.text).toBe('');expect(Math.abs(blank.top)).toBeLessThan(2)
 await page.getByRole('button',{name:'上一页',exact:true}).click();await expect(page.locator('.page-heading')).toHaveText('第 2 页，共 3 页')
 await page.keyboard.press('Control+s');await expect(page.locator('.page-footer')).toContainText('已保存到本机');await closePanel();await app.close();await launch()
 await page.keyboard.press('4');await page.getByRole('button',{name:'未命名笔记',exact:true}).click();await expect(page.locator('.tiptap')).toContainText('第一页正文保留。');await expect(page.locator('.tiptap')).toContainText('第二页正文独立。');await expect(page.locator('.page-heading')).toContainText('共 3 页')
 await page.getByRole('button',{name:'书名与标签…',exact:true}).click();await page.getByRole('button',{name:'放到讲台阅读',exact:true}).click();await page.locator('.tiptap').press('Control+End');await expect(page.locator('.page-forward')).toBeDisabled()
 await closePanel();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'游戏菜单',exact:true})).toBeVisible()
 const closing=app.waitForEvent('close');await page.getByRole('button',{name:'保存并退出',exact:true}).click();await closing;closed=true
 const db=new DatabaseSync(path.join(dir,'blocknotes.sqlite'));try{const row=db.prepare('SELECT doc,plain FROM notes').get() as {doc:string;plain:string};expect(JSON.parse(row.doc).content.filter((n:{type:string})=>n.type==='bookPageBreak')).toHaveLength(2);expect(row.plain).toContain('第二页正文独立。')}finally{db.close()}
})

test('唱片机完整原声库、流式播放、翻曲、暂停、音量持久化与笔记共存',async()=>{
 const manifest=JSON.parse(readFileSync('public/minecraft/sounds/music-manifest.json','utf8'))
 expect(manifest.version).toBe('1.21');expect(manifest.tracks.filter((t:any)=>t.groups.includes('records'))).toHaveLength(19);expect(manifest.tracks.filter((t:any)=>!t.groups.includes('records'))).toHaveLength(0)
 for(const track of manifest.tracks)expect(createHash('sha1').update(readFileSync('public/minecraft/sounds/'+track.id+'.ogg')).digest('hex')).toBe(track.sha1)
 await launch();await page.addInitScript(()=>{const Original=window.Audio;window.Audio=class extends Original{constructor(...args:ConstructorParameters<typeof Audio>){super(...args);(window as any).__musicAudio=this}}});await page.reload();await expect(page.locator('.world')).toHaveAttribute('data-ready','true')
 const sound=()=>page.evaluate(()=>{const a=(window as any).__musicAudio as HTMLAudioElement;return{paused:a.paused,time:a.currentTime,src:a.currentSrc,duration:a.duration,volume:a.volume}})
 await clickEntity('唱片机',[[.55,.75],[.56,.74],[.55,.77]],'唱片机');await expect(page.locator('.music-track')).toHaveCount(19);expect((await sound()).paused).toBe(true)
 await page.getByRole('button',{name:'播放 Creator',exact:true}).click();await expect.poll(async()=>(await sound()).time).toBeGreaterThan(0);expect((await sound()).src).toContain('/records/creator.ogg')
 await page.getByRole('textbox',{name:'查找音乐',exact:true}).fill('cat');await page.getByRole('button',{name:'播放 Cat',exact:true}).click();await expect.poll(async()=>(await sound()).src).toContain('/records/cat.ogg');await expect.poll(async()=>(await sound()).duration).toBeGreaterThan(60)
 await page.getByRole('button',{name:'暂停音乐',exact:true}).click();expect((await sound()).paused).toBe(true);await page.getByRole('slider',{name:'音乐播放进度',exact:true}).fill('20');await expect.poll(async()=>(await sound()).time).toBeGreaterThanOrEqual(20)
 await page.getByRole('button',{name:'播放音乐',exact:true}).click();await expect.poll(async()=>(await sound()).paused).toBe(false);await page.getByRole('button',{name:'下一首',exact:true}).click();await expect.poll(async()=>(await sound()).src).not.toContain('/records/cat.ogg');await page.getByRole('button',{name:'上一首',exact:true}).click();await expect.poll(async()=>(await sound()).src).toContain('/records/cat.ogg')
 const volume=page.getByRole('slider',{name:'音乐音量',exact:true});await volume.press('Home');await expect.poll(async()=>(await sound()).volume).toBe(0);await volume.press('ArrowRight');await expect(volume).toHaveValue('0.05')
 await closePanel();await expect(page.locator('.record-notice')).toContainText('正在播放：C418 - cat');await expect(page.locator('.world')).toHaveAttribute('data-record-playing','true');await expect.poll(()=>page.locator('canvas').getAttribute('data-note-visible'),{intervals:[50]}).toBe('true');await page.screenshot({path:'test-results/05-record-playing.png'});await expect(page.locator('.record-notice')).toHaveCount(0,{timeout:5000});await page.keyboard.press('Control+n');await page.locator('.tiptap').fill('听原版唱片时继续记录中文笔记。');await page.keyboard.press('Control+s');await expect(page.locator('.page-footer')).toContainText('已保存到本机');expect((await sound()).paused).toBe(false);await closePanel()
 await expect.poll(()=>page.locator('canvas').getAttribute('data-note-visible'),{intervals:[25]}).toBe('true');await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'游戏菜单',exact:true})).toBeVisible();await expect.poll(async()=>(await sound()).paused).toBe(true);await expect(page.locator('canvas')).toHaveAttribute('data-note-visible','true');await page.waitForTimeout(450);await expect(page.locator('canvas')).toHaveAttribute('data-note-visible','true');await page.keyboard.press('Escape');await expect.poll(async()=>(await sound()).paused).toBe(false);await expect(page.locator('.record-notice')).toHaveCount(0)
 await app.close();await launch();await page.keyboard.press('7');await expect(page.getByRole('slider',{name:'音乐音量',exact:true})).toHaveValue('0.05');await expect(page.locator('.music-current')).toContainText('Cat');await expect(page.getByRole('button',{name:'播放音乐',exact:true})).toBeVisible();await closePanel();await page.keyboard.press('4');await page.getByRole('button',{name:'未命名笔记',exact:true}).click();await expect(page.locator('.tiptap')).toContainText('听原版唱片')
})
