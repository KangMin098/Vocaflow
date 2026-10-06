// scripts/csat/reveal-gate/live-db-watch.mjs
export function watchLiveDb(client,onFailure,{intervalMs=10000,schedule=setInterval,cancel=clearInterval}={}) {
  let failed=false
  const fail=error=>{if(!failed)onFailure({reason:'db_connection_lost',code:typeof error?.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:null});failed=true}
  client.on('error',fail)
  const timer=schedule(()=>{if(!failed)try{Promise.resolve(client.query('select 1')).catch(fail)}catch(error){fail(error)}},intervalMs)
  timer.unref?.()
  return{failed:()=>failed,stop:()=>cancel(timer)}
}
