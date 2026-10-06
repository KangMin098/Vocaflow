// scripts/csat/reveal-gate/tls-config.mjs
// URL SSL parameters must not replace node-postgres' explicit verified TLS settings.
export function verifiedDbConfig(connectionString,ca) {
  const url=new URL(connectionString)
  if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('Invalid PostgreSQL protocol')
  for(const key of ['ssl','sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(key)
  return {connectionString:url.href,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})}}
}
