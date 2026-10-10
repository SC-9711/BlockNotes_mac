import {spawn} from 'node:child_process'
import electron from 'electron'
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js'],{stdio:'inherit'})
let child
for(let i=0;i<80;i++){try{await fetch('http://127.0.0.1:5173');break}catch{await new Promise(r=>setTimeout(r,250))}}
const env={...process.env,BLOCKNOTES_DEV_URL:'http://127.0.0.1:5173'};delete env.ELECTRON_RUN_AS_NODE
child=spawn(electron,['.'],{stdio:'inherit',env});child.on('exit',()=>vite.kill());
process.on('SIGINT',()=>{child?.kill();vite.kill()})
