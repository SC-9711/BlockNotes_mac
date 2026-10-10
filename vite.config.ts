import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import {pipeline} from 'node:stream/promises'
const require=createRequire(import.meta.url)
export default defineConfig({
  base:'./', plugins:[react(),{
    name:'local-sqlite-development',
    configureServer(server) {
      const {openStore}=require('./server/storage.cjs')
      const dataDirectory=process.env.BLOCKNOTES_DATA_DIR||path.resolve('.local'),store=openStore(dataDirectory)
      const {backupFileTask}=require('./server/backup-file.cjs')
      server.httpServer?.on('close',()=>store.close())
      server.middlewares.use('/api',async(req,res)=>{
        res.setHeader('Content-Type','application/json; charset=utf-8')
        const origin=req.headers.origin
        if(req.method!=='POST'||!req.headers.host?.startsWith('127.0.0.1:')||(origin&&origin!==`http://${req.headers.host}`)||!req.headers['content-type']?.startsWith('application/json')){res.statusCode=403;res.end(JSON.stringify({error:'仅支持本机应用请求'}));return}
        if(req.url==='/restore-file'){
          const temp=fs.mkdtempSync(path.join(os.tmpdir(),'blocknotes-upload-')),file=path.join(temp,'backup.json')
          try{await pipeline(req,fs.createWriteStream(file,{flags:'wx'}));res.end(JSON.stringify({result:await backupFileTask('restore',dataDirectory,file)}))}
          catch(e){res.statusCode=400;res.end(JSON.stringify({error:e instanceof Error?e.message:'恢复失败'}))}
          finally{if(path.dirname(temp)===path.resolve(os.tmpdir())&&path.basename(temp).startsWith('blocknotes-upload-'))fs.rmSync(temp,{recursive:true,force:true})}return
        }
        try {let body='';for await (const chunk of req){body+=chunk;if(body.length>64_000_000)throw new Error('请求过大')}
          const {operation,input}=JSON.parse(body);res.end(JSON.stringify({result:store.run(operation,input)}))
        } catch(e){res.statusCode=400;res.end(JSON.stringify({error:e instanceof Error?e.message:'存储失败'}))}
      })
    }
  }], server:{host:'127.0.0.1',port:5173,strictPort:true},
  build:{rollupOptions:{output:{manualChunks:{scene:['three','@react-three/fiber'],editor:['@tiptap/react','@tiptap/starter-kit']}}}}
})
