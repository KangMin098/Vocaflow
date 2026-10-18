// apps/web/scripts/final-independent/audit-task-support.ts
// Current repository inventory; metadata readiness is not released FQ support.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { tasks, checkKeysOfTask, CANON_VERSION } from '../../src/lib/csat/map/v4/definition'
const rows = tasks().map(t => ({id:t.id,name:t.name,status:t.status,directCheck:t.direct_check,checkKeys:checkKeysOfTask(t.id),criterion:t.learner_criterion,quantityPolicy:t.quantity_policy}))
const counts = Object.fromEntries(['live','ready','content_needed','blocked'].map(k => [k,rows.filter(r=>r.directCheck===k).length]))
console.log(JSON.stringify({scope:'REPOSITORY_METADATA_ONLY',definition:CANON_VERSION,totalTasks:rows.length,counts,definitionSha256:createHash('sha256').update(fs.readFileSync('src/lib/csat/map/v4/definition.data.ts')).digest('hex'),warning:'directCheck metadata is not live FQ, independent performance, or learning effect verification',rows},null,2))
