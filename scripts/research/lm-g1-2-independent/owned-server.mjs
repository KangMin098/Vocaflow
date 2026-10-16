// scripts/research/lm-g1-2-independent/owned-server.mjs
// Only accepts the ChildProcess created by this runner; never discovers or stops other servers.
import {spawnSync} from 'node:child_process'
export async function stopOwnedServer(child) {
 if(!child)return {owned:false,stopped:false}
 await new Promise(setImmediate)
 if(child.exitCode!==null||child.signalCode!==null)return {owned:true,stopped:false,alreadyExited:true}
 let timer
 const closed=new Promise((resolve,reject)=>{child.once('exit',resolve);timer=setTimeout(()=>reject(Error('Owned server did not exit')),10000)})
 try {
  if(process.platform==='win32'){const r=spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error('Owned server cleanup failed: '+r.status)}
  else if(!child.kill('SIGTERM'))throw Error('Owned server cleanup failed')
  await closed
  return {owned:true,stopped:true}
 } finally {clearTimeout(timer)}
}
