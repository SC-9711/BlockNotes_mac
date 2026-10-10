const path=require('node:path');
const {Worker}=require('node:worker_threads');

// File data stays off Electron's UI thread and never crosses renderer IPC.
function backupFileTask(operation,directory,file){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(path.join(__dirname,'backup-worker.cjs'),{workerData:{operation,directory,file}});let settled=false;
    worker.once('message',message=>{settled=true;message.error?reject(new Error(message.error)):resolve(message.result);});
    worker.once('error',error=>{settled=true;reject(error);});
    worker.once('exit',code=>{if(!settled)reject(new Error(`备份处理意外退出 (${code})，未确认恢复成功`));});
  });
}
module.exports={backupFileTask};
