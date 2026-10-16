// scripts/research/lm-g1-3a-independent/lost-response-probe.mjs
// Exact hook, minimal scheduler: response loss after server commit; browser tested separately.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { execFileSync } from 'node:child_process'; import { randomUUID } from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../../..'),req=createRequire(root+'/apps/web/package.json'),ts=req('typescript'),file='apps/web/src/components/csat/diagnosis/map/GoalBar.tsx';
const rows=[];
for(const source of ['bd0bc930c','working']) {
 const text=source==='working'?fs.readFileSync(root+'/'+file,'utf8'):execFileSync('git',['show',source+':'+file],{cwd:root,encoding:'utf8'});
 const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),hook=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='useGoal');
 const js=ts.transpileModule(hook.getText(ast).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 let cursor=0,states=[],requests=[],stored=80,refreshes=0;
 const useState=initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]};
 const useRef=initial=>{const i=cursor++;if(!(i in states))states[i]={current:initial};return states[i]};
 const fn=new Function('useRouter','useState','useEffect','useTransition','useRef','extraOf','crypto','fetch','track',js+';return useGoal')(()=>({refresh(){refreshes++}}),useState,()=>{},()=>[false,cb=>cb()],useRef,d=>({exam:d.v4.target.goal.exam,grade:null,date:null}),{randomUUID},async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);stored=body.target;if(requests.length===1)throw Error('injected response lost after commit');return {ok:true}},()=>{});
 const data={model:{goal:80,goalSet:true},v4:{target:{goal:{score:80,exam:'suneung',id:1}}}};
 const render=()=>{cursor=0;return fn(data)};
 await render().apply(90,{exam:'kice6',grade:2,date:null});
 const failed=render(),afterFailure={displayed:failed.goal,draft:failed.draft,exam:failed.extra.exam,error:failed.err};
 await failed.apply(Number(failed.draft),failed.extra);
 rows.push({source,afterFailure,finalStored:stored,sameKey:requests[0].clientKey===requests[1].clientKey,sameBody:JSON.stringify(requests[0])===JSON.stringify(requests[1]),refreshes,pass:afterFailure.displayed===80&&afterFailure.draft==='90'&&afterFailure.exam==='kice6'&&stored===90&&requests[0].clientKey===requests[1].clientKey});
}
fs.writeFileSync(path.join(import.meta.dirname,'local/lost-response-hook.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
process.exitCode=rows.find(r=>r.source==='working')?.pass?0:1;
