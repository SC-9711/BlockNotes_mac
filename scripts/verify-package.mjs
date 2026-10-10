import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
const {extractFile,listPackage}=createRequire(import.meta.url)('@electron/asar')
const directory=path.resolve(process.argv[2]||'release/p1-fix/win-unpacked'),archive=path.join(directory,'resources/app.asar')
const pkg=JSON.parse(extractFile(archive,'package.json').toString())
if(pkg.main!=='electron/main.cjs'||pkg.name!=='blocknotes')throw new Error('应用入口损坏或不符')
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
let checked=0
function verify(file){if(hash(fs.readFileSync(file))!==hash(extractFile(archive,path.normalize(file))))throw new Error('打包代码与源码不符：'+file);checked++}
function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){if(file!==path.join('dist','minecraft'))visit(file)}else verify(file)}}
for(const dir of ['server','electron','dist'])visit(dir)
verify('THIRD_PARTY_NOTICES.md')
verify('LICENSE')
const assets=listPackage(archive).filter(file=>file.replaceAll('\\','/').startsWith('/dist/minecraft/')).length
if(assets)throw new Error('原版资源被打进 app.asar')
const publicPackage=process.argv.includes('--public')
if(publicPackage){
 const forbidden=/^(minecraft|\.local|backups)$/i,forbiddenFile=/\.(ogg|jar|sqlite(?:-[\w]+)?|db|mp4)$/i
 function inspect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){if(forbidden.test(entry.name))throw new Error('公开包包含本地资源或数据目录：'+entry.name);inspect(file)}else if(forbiddenFile.test(entry.name))throw new Error('公开包包含禁止分发的资源或数据文件：'+entry.name)}}
 inspect(directory)
 for(const file of listPackage(archive)){const normalized=file.replaceAll('\\','/');if(normalized.split('/').some(segment=>forbidden.test(segment))||forbiddenFile.test(normalized))throw new Error('公开 ASAR 包含本地资源或数据文件：'+normalized)}
}
console.log(JSON.stringify({directory,main:pkg.main,verifiedSourceFiles:checked,gameAssetsInAsar:assets,publicPackage,appAsarSha256:hash(fs.readFileSync(archive))}))
