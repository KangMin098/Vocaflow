import fs from 'node:fs'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const cwd='D:/workspace/Vocaflow-main-serving',dir='D:/workspace/Vocaflow-AI-Control/verification/reviews/T-0087-r1-independent',source='1607faebb096a4a361347f9cd80a45f23d0457a2',expectedBase='d726c5d07234a0dfb2d3b1dfa0e827b14d7adb77'
const git=(...a)=>execFileSync('git',a,{cwd,encoding:'utf8'}).trim(),lock=verb=>execFileSync('node',['agents/scripts/lock.mjs',verb,'codex','--pid','19700'],{cwd,stdio:'inherit'})
assert.equal(git('branch','--show-current'),'main');assert.equal(git('rev-parse','HEAD'),expectedBase)
let resuming=false
try{resuming=git('rev-parse','MERGE_HEAD')===source}catch{}
if(!resuming){assert.equal(git('status','--porcelain','--untracked-files=no'),'');lock('acquire');assert.equal(git('rev-parse','HEAD'),expectedBase);assert.equal(git('status','--porcelain','--untracked-files=no'),'');execFileSync('git',['merge','--no-ff','--no-commit',source],{cwd,stdio:'inherit'})}
else {const own=JSON.parse(fs.readFileSync(cwd+'/.agent-lock','utf8'));assert.equal(own.pid,19700);assert.equal(own.agent,'codex')}
const files=git('diff','--cached','--name-only').split('\n');assert.deepEqual(files,['docs/final/FINAL_LEDGER.md','docs/final/review/r5-authored-gold-packet.md']);assert.equal(git('diff','--name-only'),'')
const verified=JSON.parse(fs.readFileSync(dir+'/verification.json','utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
assert.equal(sha(fs.readFileSync(cwd+'/docs/final/review/r5-authored-gold-packet.md')),verified.packet_sha256)
assert.equal(sha(fs.readFileSync(cwd+'/apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json')),verified.file_sha256)
const packetPath=cwd+'/docs/final/review/r5-authored-gold-packet.md',packetText=fs.readFileSync(packetPath,'utf8')
fs.writeFileSync(packetPath,packetText.replace(/(?:\r?\n)+$/,packetText.includes('\r\n')?'\r\n':'\n'))
git('add','--','docs/final/review/r5-authored-gold-packet.md')
git('diff','--check','--cached');const tree=git('write-tree')
fs.writeFileSync(dir+'/merge-message.txt','merge: restore the hash-bound first R5 review packet\n\nIntegrate accepted T-0087 docs only: eight readable v3 items and ledger.\nIndependent content transcription and sixteen hash bindings verified.\nNo content approval, DB writes or source content changes.\n\nCo-Authored-By: Codex <noreply@openai.com>\n')
execFileSync('git',['commit','-F',dir+'/merge-message.txt'],{cwd,stdio:'inherit'})
assert.equal(git('rev-parse','HEAD^{tree}'),tree);lock('release')
const result={task:'T-0087',source,base:expectedBase,merge_commit:git('rev-parse','HEAD'),files,tested_tree:tree,committed_tree:git('rev-parse','HEAD^{tree}'),diff_check_exit:0,packet_initial_diff_check:'new blank line at EOF; removed surplus final empty line only',packet_sha256:sha(fs.readFileSync(packetPath)),source_content_hash_unchanged:true,main_clean:git('status','--porcelain','--untracked-files=no')==='',lock_released:true,db_writes:0,human_decisions_recorded:0,remote_push:false,remote_ci:false,content_release_approved:false}
fs.writeFileSync(dir+'/local-main-integration.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))
