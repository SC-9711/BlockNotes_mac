const {app,BrowserWindow,ipcMain,dialog,Menu,protocol,net,utilityProcess}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {openStore}=require('../server/storage.cjs');
const {serveAudio}=require('./local-media.cjs');
const {backupFileTask}=require('../server/backup-file.cjs');
const {activePack,validatePack}=require('../server/resources.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'blocknotes',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
if(process.env.BLOCKNOTES_DATA_DIR)app.setPath('userData',path.resolve(process.env.BLOCKNOTES_DATA_DIR));
if(process.platform==='win32')app.setAppUserModelId('studio.blocknotes.desktop');
const locked=app.requestSingleInstanceLock();
if(!locked)app.quit();
let win,store,allowClose=false,resourceRoot=null,resourceJob=null;
let resourceState={ready:false,busy:false,phase:'准备资源',done:0,total:0,error:''};
function resourceUpdate(patch){resourceState={...resourceState,...patch};if(win&&!win.isDestroyed())win.webContents.send('blocknotes:resources',resourceState);}
function startResources(){
  if(resourceRoot||resourceJob)return resourceState;
  resourceUpdate({busy:true,error:'',phase:'连接原版资源服务器',done:0,total:0});
  const job=utilityProcess.fork(path.join(__dirname,'resource-worker.cjs'),[],{serviceName:'BlockNotes Resource Setup',stdio:'pipe'});resourceJob=job;
  job.on('message',message=>{
    if(message.type==='progress')resourceUpdate(message.state);
    if(message.type==='error')resourceUpdate({busy:false,error:message.message});
    if(message.type==='ready'){
      if(validatePack(message.root)){resourceRoot=message.root;resourceUpdate({ready:true,busy:false,error:''});}
      else resourceUpdate({busy:false,error:'资源校验未通过，请重试。'});
    }
  });
  job.on('exit',()=>{if(resourceJob===job)resourceJob=null;if(!resourceRoot&&resourceState.busy)resourceUpdate({busy:false,error:'资源准备中断，请重试。'});});
  job.postMessage({userData:app.getPath('userData')});return resourceState;
}
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
app.whenReady().then(()=>{
  if(!locked)return;
  const bundled=app.isPackaged?path.join(process.resourcesPath,'minecraft'):path.resolve(__dirname,'../dist/minecraft');
  resourceRoot=activePack(app.getPath('userData'))||(validatePack(bundled)?bundled:null);resourceState.ready=!!resourceRoot;
  try{store=openStore(app.getPath('userData'));}catch(e){dialog.showErrorBox('无法打开书房数据',e.message+'\n\n未清空或重建原数据库。数据目录：'+app.getPath('userData'));app.quit();return;}
  protocol.handle('blocknotes',request=>{
    const u=new URL(request.url);const rel=decodeURIComponent(u.pathname);const localAssets=rel.startsWith('/minecraft/');if(localAssets&&!resourceRoot)return new Response('Resource setup required',{status:404});const root=localAssets?resourceRoot:path.resolve(__dirname,'../dist');const file=path.resolve(root,'.'+(localAssets?rel.slice('/minecraft'.length):rel));
    if(u.host!=='app'||!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
    if(file.endsWith('.ogg')){if(!fs.existsSync(file))return new Response('Missing audio',{status:404});return serveAudio(file,request);}
    return net.fetch(pathToFileURL(file).toString());
  });
  win=new BrowserWindow({width:1360,height:900,minWidth:760,minHeight:600,backgroundColor:'#292d29',title:'BlockNotes · 方块书房',icon:path.join(__dirname,'../dist/branding/blocknotes.ico'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  // macOS routes copy/paste/undo and Cmd+Q through the application menu; removing it breaks text editing there.
  Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([{role:'appMenu'},{role:'editMenu'},{role:'windowMenu'}]):null);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));
  const dev=process.env.BLOCKNOTES_DEV_URL==='http://127.0.0.1:5173';
  const valid=e=>e.sender===win.webContents&&(e.senderFrame?.url.startsWith('blocknotes://app/')||(dev&&e.senderFrame?.url.startsWith('http://127.0.0.1:5173/')));
  ipcMain.handle('blocknotes:command',async(e,operation,input)=>{
    if(!valid(e))throw new Error('不可信请求');
    if(operation==='resourceStatus')return resourceState;
    if(operation==='resourceStart')return startResources();
    if(operation==='resourceQuit'){if(!resourceRoot){allowClose=true;app.quit();return{closing:true};}throw new Error('资源已准备完成');}
    if(operation==='quit'){win.close();return {closing:true};}
    if(operation==='exportFile'||operation==='backupFile'){
      const result=operation==='exportFile'?store.run('export',input):{name:`BlockNotes-备份-${new Date().toISOString().slice(0,10)}.json`};
      const {filePath,canceled}=await dialog.showSaveDialog(win,{defaultPath:result.name,filters:[{name:operation==='exportFile'?'Markdown':'BlockNotes 备份',extensions:[operation==='exportFile'?'md':'json']}]});
      if(canceled)return {canceled:true};if(operation==='backupFile')return backupFileTask('backup',app.getPath('userData'),filePath);
      const tmp=filePath+'.'+Date.now()+'.tmp';try{fs.writeFileSync(tmp,result.text,{encoding:'utf8',flag:'wx'});fs.renameSync(tmp,filePath);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}return {filePath};
    }
    if(operation==='restoreFile'){
      const {filePaths,canceled}=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'BlockNotes 备份',extensions:['json']}]});if(canceled)return{canceled:true};
      return backupFileTask('restore',app.getPath('userData'),filePaths[0]);
    }
    return store.run(operation,input);
  });
  win.webContents.on('will-navigate',(e,url)=>{if(!(url.startsWith('blocknotes://app/')||(dev&&url.startsWith('http://127.0.0.1:5173/'))))e.preventDefault();});
  win.on('close',e=>{if(!resourceRoot){allowClose=true;resourceJob?.kill();return;}if(!allowClose){e.preventDefault();win.webContents.send('blocknotes:prepare-close');}});
  ipcMain.on('blocknotes:close-ready',e=>{if(valid(e)){allowClose=true;win.close();}});
  win.webContents.on('render-process-gone',()=>{allowClose=true;dialog.showErrorBox('编辑窗口已退出','数据库中的已保存笔记仍在。重新启动后将检查未完成草稿。');app.quit();});
  win.once('ready-to-show',()=>win.show());
  dev?win.loadURL('http://127.0.0.1:5173/'):win.loadURL('blocknotes://app/index.html');
});
app.on('window-all-closed',()=>app.quit());
app.on('will-quit',()=>{resourceJob?.kill();store?.close();});
