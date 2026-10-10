export async function call<T=any>(operation:string,input:unknown={}):Promise<T>{
  if(window.blocknotes)return window.blocknotes.call(operation,input)
  const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,input})})
  const data=await response.json();if(data.error)throw new Error(data.error);return data.result
}
export async function restoreUploadedFile(file:File){
  const response=await fetch('/api/restore-file',{method:'POST',headers:{'Content-Type':'application/json'},body:file})
  const data=await response.json();if(data.error)throw new Error(data.error);return data.result as {added:number;duplicates:number}
}
export async function saveFile(operation:'exportFile'|'backupFile',input:unknown={}){
  if(window.blocknotes)return call(operation,input)
  const data=await call(operation==='exportFile'?'export':'backup',input)
  const blob=new Blob([operation==='exportFile'?data.text:JSON.stringify(data,null,2)],{type:operation==='exportFile'?'text/markdown;charset=utf-8':'application/json'})
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=operation==='exportFile'?data.name:`BlockNotes-备份-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return{canceled:false}
}
