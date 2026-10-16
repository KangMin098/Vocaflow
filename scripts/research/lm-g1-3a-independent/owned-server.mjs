// scripts/research/lm-g1-3a-independent/owned-server.mjs
import {stopOwnedServer as stop} from '../lm-g1-2-independent/owned-server.mjs'
export async function stopOwnedServer(child) {
 try {return await stop(child)} catch(error) {
  if(child?.pid) {try {process.kill(child.pid,0)} catch(e) {if(e.code==='ESRCH')return {owned:true,stopped:false,alreadyExited:true,absenceConfirmed:true}}}
  throw error
 }
}
