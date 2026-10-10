const {net}=require('electron');
const {installResources}=require('../server/resources.cjs');
const controller=new AbortController();
process.parentPort.once('message',async({data})=>{
  try{const root=await installResources(data.userData,{fetcher:(...args)=>net.fetch(...args),signal:controller.signal,onProgress:state=>process.parentPort.postMessage({type:'progress',state})});process.parentPort.postMessage({type:'ready',root});}
  catch(error){process.parentPort.postMessage({type:'error',message:error.message});}
  finally{setTimeout(()=>process.exit(0),100);}
});
process.parentPort.on('message',({data})=>{if(data.cancel)controller.abort();});
