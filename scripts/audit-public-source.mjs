// Read-only pre-publication check. Never prints matched credentials or reads userData.
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
function git(args,input){
 const result=spawnSync('git',['-c','core.quotepath=false',...args],{cwd:root,input,maxBuffer:128*1024*1024})
 if(result.status!==0)throw new Error('Git audit command failed: '+args[0])
 return result.stdout
}
const files=[...new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean))].sort()
const errors=[],warnings=[],seen=new Set()
const forbidden=/^(?:public\/minecraft|dist|release|node_modules|\.local|backups|test-results|playwright-report|artifacts\/(?:screenshots|delivery))(?:\/|$)|(?:^|\/)\.env(?:\.|$)|\.(?:sqlite(?:-[\w]+)?|db(?:-[\w]+)?|ogg|mp4|jar|pem|key|pfx|p12)$/i
const patterns=[
 ['github-token',/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['aws-access-key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
 ['credential-url',/https?:\/\/[^\s/@:]+:[^\s/@]+@/],
]
const privatePath=/[A-Z]:[\\/]Users[\\/][^\s\\/<>]+[\\/]|wxid_[a-z0-9_]+/i
function record(bucket,kind,file,revision){
 const key=[kind,file,revision||'working-tree'].join(':')
 if(seen.has(key))return;seen.add(key);bucket.push({kind,file,...(revision?{revision}:{} )})
}
function checkName(file,revision){if(forbidden.test(file)&&file!=='.env.example')record(errors,'excluded-file-present',file,revision)}
function checkBytes(file,bytes,revision){
 if(bytes.length>50*1024*1024)record(errors,'large-file-over-50-MiB',file,revision)
 if(bytes.includes(0))return // Binary assets need separate provenance review.
 const source=bytes.toString('utf8')
 for(const [kind,expression] of patterns)if(expression.test(source))record(errors,kind,file,revision)
 if(privatePath.test(source))record(warnings,'personal-path-needs-review',file,revision)
}
let bytes=0
for(const file of files){
 checkName(file)
 const absolute=path.resolve(root,file)
 if(!absolute.startsWith(root+path.sep))throw new Error('Source path escaped repository')
 if(!fs.existsSync(absolute)){record(errors,'missing-tracked-file',file);continue}
 const stat=fs.lstatSync(absolute)
 if(!stat.isFile()){record(errors,'non-regular-source-file',file);continue}
 const data=fs.readFileSync(absolute);bytes+=data.length;checkBytes(file,data)
}
for(const required of ['LICENSE','README.md','THIRD_PARTY_NOTICES.md','package-lock.json'])if(!files.includes(required))record(errors,'missing-public-document',required)
const ignoreChecks=['public/minecraft/check.png','.local/check.json','release/check.exe','artifacts/delivery/check.json','.env','private.sqlite']
for(const file of ignoreChecks){const result=spawnSync('git',['check-ignore','--quiet','--no-index',file],{cwd:root});if(result.status!==0)record(errors,'ignore-rule-missing',file)}

let historyBlobs=0,historyBytes=0
if(process.argv.includes('--history')){
 const objects=git(['rev-list','--objects','--all']).toString().trim().split('\n').filter(Boolean)
 const names=new Map()
 for(const line of objects){const separator=line.indexOf(' ');if(separator<0)continue;const id=line.slice(0,separator),file=line.slice(separator+1);names.set(id,file);checkName(file,id.slice(0,12))}
 const metadata=git(['cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],objects.map(line=>line.split(' ')[0]).join('\n')+'\n').toString().trim().split('\n')
 const blobs=metadata.map(line=>line.split(' ')).filter(([,type])=>type==='blob')
 for(const [id,,size] of blobs)if(Number(size)>50*1024*1024)record(errors,'historical-large-file',names.get(id)||id,id.slice(0,12))
 // Refuse unusually large histories rather than silently omitting their content scan.
 const total=blobs.reduce((sum,[,,size])=>sum+Number(size),0)
 if(total>100*1024*1024)throw new Error('History exceeds 100 MiB; use a dedicated history/secret scanner before publishing')
 const output=git(['cat-file','--batch'],blobs.map(([id])=>id).join('\n')+'\n')
 let offset=0
 for(const [id] of blobs){
  const end=output.indexOf(10,offset),header=output.subarray(offset,end).toString(),size=Number(header.split(' ')[2])
  if(end<0||!Number.isFinite(size))throw new Error('Invalid Git blob stream')
  const data=output.subarray(end+1,end+1+size);offset=end+size+2
  historyBlobs++;historyBytes+=size;checkBytes(names.get(id)||id,data,id.slice(0,12))
 }
}
const report={schemaVersion:1,checkedAt:new Date().toISOString(),head:git(['rev-parse','--short','HEAD']).toString().trim(),candidateFiles:files.length,candidateBytes:bytes,historyBlobs,historyBytes,errors,warnings,limits:'Pattern-based audit only. It does not prove absence of every secret, validate binary rights, or grant game-asset redistribution permission.'}
const outputArgument=process.argv.find(argument=>argument.startsWith('--output='))
if(outputArgument){
 const destination=path.resolve(root,outputArgument.slice('--output='.length))
 if(!destination.startsWith(path.join(root,'.local')+path.sep))throw new Error('Audit reports must remain under ignored .local/')
 fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n')
}
console.log(JSON.stringify(report,null,2))
if(errors.length)process.exitCode=1
