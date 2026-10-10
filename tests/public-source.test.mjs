import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync,spawnSync} from 'node:child_process'

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blocknotes-public-audit-'))
 t.after(()=>{if(path.dirname(root)===path.resolve(os.tmpdir())&&path.basename(root).startsWith('blocknotes-public-audit-'))fs.rmSync(root,{recursive:true,force:true})})
 const git=(...args)=>execFileSync('git',['-c','user.name=Test','-c','user.email=test@local.invalid',...args],{cwd:root,stdio:'pipe'})
 git('init','--initial-branch=main');fs.mkdirSync(path.join(root,'scripts'))
 fs.copyFileSync('scripts/audit-public-source.mjs',path.join(root,'scripts/audit-public-source.mjs'))
 fs.copyFileSync('.gitignore',path.join(root,'.gitignore'))
 for(const file of ['LICENSE','README.md','THIRD_PARTY_NOTICES.md','package-lock.json'])fs.writeFileSync(path.join(root,file),'test fixture\n')
 git('add','.');git('commit','-m','fixture')
 const audit=()=>{const result=spawnSync(process.execPath,['scripts/audit-public-source.mjs','--history'],{cwd:root,encoding:'utf8'});assert.ok(result.stdout,result.stderr);return{status:result.status,report:JSON.parse(result.stdout)}}
 return{root,git,audit}
}

test('公开源码审查忽略本地数据，干净源码和历史通过',t=>{
 const {root,audit}=fixture(t)
 fs.mkdirSync(path.join(root,'public/minecraft'),{recursive:true});fs.writeFileSync(path.join(root,'public/minecraft/test.ogg'),'private local fixture')
 fs.writeFileSync(path.join(root,'personal.sqlite'),'private data fixture')
 const result=audit();assert.equal(result.status,0);assert.equal(result.report.errors.length,0);assert.equal(result.report.warnings.length,0);assert.ok(result.report.historyBlobs>0)
})

test('强制提交的游戏资源和随后删除的历史资源仍阻止发布',t=>{
 const {root,git,audit}=fixture(t)
 fs.mkdirSync(path.join(root,'public/minecraft'),{recursive:true});fs.writeFileSync(path.join(root,'public/minecraft/test.ogg'),'synthetic test bytes')
 git('add','--force','public/minecraft/test.ogg');git('commit','-m','resource fixture')
 assert.equal(audit().status,1)
 git('rm','public/minecraft/test.ogg');git('commit','-m','remove fixture')
 const result=audit();assert.equal(result.status,1);assert.ok(result.report.errors.some(item=>item.kind==='excluded-file-present'&&item.revision))
})

test('已删除的历史令牌仍阻止发布，日志不回显令牌',t=>{
 const {root,git,audit}=fixture(t),token=['ghp','A'.repeat(36)].join('_')
 fs.writeFileSync(path.join(root,'config.txt'),token);git('add','config.txt');git('commit','-m','credential fixture')
 git('rm','config.txt');git('commit','-m','remove fixture')
 const result=audit();assert.equal(result.status,1);assert.ok(result.report.errors.some(item=>item.kind==='github-token'&&item.revision));assert.ok(!JSON.stringify(result.report).includes(token))
})
