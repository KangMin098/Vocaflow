// scripts/csat/reveal-gate/verification-core.mjs
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url))
const ts = require('typescript')
const SECRET = /^(correctAnswer|correct_answer|answerKey|expectedAnswer|answer_key|why_correct|why_tempting|how_to_reject|answer_locus|choice_analysis)$/
const GATE = new Set(['canRevealExam','canRevealItem','canRevealSession','embargoedExamIds','embargoedItemIds','userHasHeldSession','loadRevealScope','assertRevealAllowed','revealHeldResponse','isItemHeld','isExamHeld','isTypeHeld'])
const SENSITIVE = new Set(['ANSWER_SENSITIVE','CORRECTNESS','CORRECTNESS_OWN_PRIOR','CORRECTNESS_ORACLE','REVIEWER_INTERNAL','ADMIN_ONLY','DERIVED_SECRET'])
export const relative = (root, file) => path.relative(root,file).replace(/\\/g,'/')
export function filesUnder(dir,all=false) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() ? /^(node_modules|\.next|\.git|dist|__tests__)$/.test(e.name) ? [] : filesUnder(path.join(dir,e.name),all) : (all||/\.(?:ts|tsx|mts|js|mjs|json)$/.test(e.name)) && !/\.(test|spec)\./.test(e.name) ? [path.join(dir,e.name)] : [])
}
const parse = (file, text) => ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
const visit = (node, fn) => { fn(node); ts.forEachChild(node,n=>visit(n,fn)) }
const property = node => ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : null
function constantString(node,bindings,seen=new Set()) {
  if(!node)return null
  if(ts.isStringLiteralLike(node))return node.text
  if(ts.isParenthesizedExpression(node)||ts.isAsExpression(node)||ts.isTypeAssertionExpression(node)||ts.isNonNullExpression(node))return constantString(node.expression,bindings,seen)
  if(ts.isIdentifier(node)&&bindings.has(node.text)&&!seen.has(node.text))return constantString(bindings.get(node.text),bindings,new Set([...seen,node.text]))
  if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken){const a=constantString(node.left,bindings,seen),b=constantString(node.right,bindings,seen);return a!==null&&b!==null?a+b:null}
  return null
}
export function scanLoaders(srcRoot, manifest, policy=null) {
  srcRoot=path.resolve(srcRoot)
  const objectNames=new Set([...Object.keys(manifest.db_relations),...Object.keys(manifest.db_functions).map(k=>k.split('(')[0])])
  const loader=file=>manifest.app_db_loaders?.[file]??policy?.loader_classifications?.[file]
  const issues=[], discovered=[], functions=new Map(), names=new Set([...Object.entries(manifest.db_relations).filter(([,v])=>SENSITIVE.has(v.class)||(v.sensitive_columns??[]).length||(v.secret_columns??[]).length).map(([k])=>k),...Object.entries(manifest.db_functions).filter(([,v])=>SENSITIVE.has(v.class)).map(([k])=>k.split('(')[0])])
  for(const file of filesUnder(srcRoot).filter(f=>/\.[jt]sx?$/.test(f)&&!f.endsWith('.d.ts'))) {
    const rel=relative(srcRoot,file),routePath=rel.replace(/\/\([^/]+\)/g,'')
    if(/^test\//.test(rel)) continue
    const source=parse(file,fs.readFileSync(file,'utf8')), imported=new Set(), namespaces=new Set(), hits=[]
    const adminBoundary=/^app\/api\/admin\/csat\//.test(routePath)||/^app\/admin\/(?:csat|kice)\//.test(routePath)||['app/admin/layout.tsx','lib/auth/require-admin.ts','lib/auth/require-admin-api.ts','lib/auth/account.ts','lib/auth/dev-bypass.ts'].includes(rel)
    const constants=new Map()
    const bind=(name,value)=>{if(ts.isIdentifier(name))constants.set(name.text,constants.has(name.text)?null:value);else if(name&&ts.isBindingPattern(name))for(const element of name.elements)if(ts.isBindingElement(element))bind(element.name,null)}
    visit(source,n=>{
      if(ts.isVariableDeclaration(n))bind(n.name,ts.isVariableDeclarationList(n.parent)&&(n.parent.flags&ts.NodeFlags.Const)?n.initializer:null)
      if(ts.isParameter(n)||ts.isBindingElement(n)||ts.isImportSpecifier(n)||ts.isNamespaceImport(n)||ts.isImportClause(n)&&n.name||ts.isFunctionDeclaration(n)&&n.name||ts.isClassDeclaration(n)&&n.name)bind(n.name,null)
    })
    let csatContext=/^app\/(?:[^/]+\/)?api\/csat\/|^lib\/csat\//.test(routePath)
    visit(source,n=>{if(ts.isStringLiteralLike(n)&&/^csat_/.test(n.text))csatContext=true})
    const aliases=new Set()
    visit(source,n=>{
      if(!ts.isVariableDeclaration(n)||!n.initializer)return
      if(ts.isObjectBindingPattern(n.name))for(const element of n.name.elements)if(ts.isIdentifier(element.name)&&['from','rpc'].includes(property(element.propertyName??element.name)))aliases.add(element.name.text)
      if(ts.isIdentifier(n.name)) {
        let value=n.initializer
        while(ts.isAsExpression(value)||ts.isTypeAssertionExpression(value)||ts.isParenthesizedExpression(value)||ts.isNonNullExpression(value))value=value.expression
        if(ts.isCallExpression(value)&&ts.isPropertyAccessExpression(value.expression)&&value.expression.name.text==='bind')value=value.expression.expression
        if(ts.isPropertyAccessExpression(value)&&['from','rpc'].includes(value.name.text)||ts.isElementAccessExpression(value)&&ts.isStringLiteralLike(value.argumentExpression)&&['from','rpc'].includes(value.argumentExpression.text)||ts.isIdentifier(value)&&aliases.has(value.text))aliases.add(n.name.text)
      }
    })
    let callerClass=null
    const register=node=>{
      let owner=node
      while(owner.parent&&!ts.isFunctionDeclaration(owner)&&!(ts.isArrowFunction(owner)&&ts.isVariableDeclaration(owner.parent)))owner=owner.parent
      const name=ts.isFunctionDeclaration(owner)?owner.name?.text??'<anonymous>':ts.isArrowFunction(owner)&&ts.isIdentifier(owner.parent.name)?owner.parent.name.text:'<module>'
      const code=ts.createPrinter({removeComments:true}).printNode(ts.EmitHint.Unspecified,owner,source)
      const printer=ts.createPrinter({removeComments:true})
      const assets=[]
      visit(source,n=>{const spec=(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))?n.moduleSpecifier:ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')?n.arguments[0]:null;if(spec&&ts.isStringLiteralLike(spec)&&spec.text.endsWith('.json')){const resolved=ts.resolveModuleName(spec.text,file,{baseUrl:srcRoot,paths:{'@/*':['*']},resolveJsonModule:true,moduleResolution:ts.ModuleResolutionKind.Bundler},ts.sys).resolvedModule;if(resolved)assets.push(spec.text+':'+createHash('sha256').update(fs.readFileSync(resolved.resolvedFileName)).digest('hex'))}})
      const context=source.statements.filter(n=>ts.isImportDeclaration(n)||ts.isExportDeclaration(n)||ts.isVariableStatement(n)).map(n=>printer.printNode(ts.EmitHint.Unspecified,n,source)).join('\n')+(assets.length?'\n'+assets.sort().join('\n'):'')
      const key=rel+'::'+name
      functions.set(key,{key,file:rel,function:name,sha256:createHash('sha256').update(code+'\n'+context).digest('hex'),class:loader(rel)?.class??manifest.app_file_loaders?.[rel]?.class??manifest.app_json_imports?.[rel]?.class??manifest.app_pages?.[rel.replace(/\/page\.tsx$/,'')]?.class??policy?.page_classifications?.[rel]?.class??manifest.app_api?.[routePath.replace(/^app\/api\//,'').replace(/\/route\.[jt]sx?$/,'')]?.class??policy?.function_approvals?.[key]?.class??callerClass})
    }
    visit(source,n=>{
      if(ts.isCallExpression(n)) {
        const callee=n.expression
        const alias=ts.isIdentifier(callee)&&aliases.has(callee.text)||ts.isPropertyAccessExpression(callee)&&['call','apply','bind'].includes(callee.name.text)&&(ts.isIdentifier(callee.expression)&&aliases.has(callee.expression.text)||ts.isPropertyAccessExpression(callee.expression)&&['from','rpc'].includes(callee.expression.name.text))
        if(alias){let arg=n.arguments[0];if(ts.isPropertyAccessExpression(callee)&&['call','bind'].includes(callee.name.text))arg=n.arguments[1];if(ts.isPropertyAccessExpression(callee)&&callee.name.text==='apply')arg=n.arguments[1]&&ts.isArrayLiteralExpression(n.arguments[1])?n.arguments[1].elements[0]:null
          const bindingOnly=ts.isPropertyAccessExpression(callee)&&callee.name.text==='bind'&&n.arguments.length<2
          if(!bindingOnly&&(!arg||!ts.isStringLiteralLike(arg)||/^csat_/i.test(arg.text))){issues.push({file:rel,kind:'unclassified_db_method_alias',reason:'Indirect CSAT or unresolved DB method invocation requires an explicit wrapper with reviewed literal table/RPC names.'});register(n);register(source)}
        }
      }
      let dependency=null
      if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&!n.importClause?.isTypeOnly&&n.importClause){const bindings=n.importClause.namedBindings;if(!!n.importClause.name||!bindings||!ts.isNamedImports(bindings)||bindings.elements.some(e=>!e.isTypeOnly))dependency=n.moduleSpecifier.text}
      if(ts.isExportDeclaration(n)&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)&&!n.isTypeOnly)dependency=n.moduleSpecifier.text
      if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')){dependency=constantString(n.arguments[0],constants);if(dependency===null){register(n);register(source);if(!loader(rel))issues.push({file:rel,kind:'unclassified_dynamic_server_import'})}}
      if(dependency) {
        const module=ts.resolveModuleName(dependency,file,{baseUrl:srcRoot,paths:{'@/*':['*']},moduleResolution:ts.ModuleResolutionKind.Bundler},ts.sys).resolvedModule
          if(module){const target=relative(srcRoot,path.resolve(module.resolvedFileName)),classification=loader(target)?.class??manifest.app_file_loaders?.[target]?.class??manifest.app_json_imports?.[target]?.class
            const inherited=classification??policy?.function_approvals?.[target+'::<module>']?.class
            if(SENSITIVE.has(inherited)){callerClass=inherited;register(source)}
          }
      }
      if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&/(?:^|\/)embargo-gate$/.test(n.moduleSpecifier.text)&&!n.importClause?.isTypeOnly) {
        const bindings=n.importClause?.namedBindings
        if(bindings&&ts.isNamedImports(bindings)) for(const e of bindings.elements) if(!e.isTypeOnly&&GATE.has((e.propertyName??e.name).text)) imported.add(e.name.text)
        if(bindings&&ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text)
      }
      if(ts.isCallExpression(n)&&ts.isElementAccessExpression(n.expression)&&constantString(n.expression.argumentExpression,constants)===null){register(n);register(source);if(!loader(rel))issues.push({file:rel,kind:'unclassified_computed_server_call'})}
      if(ts.isCallExpression(n)&&((ts.isPropertyAccessExpression(n.expression)&&['from','rpc'].includes(n.expression.name.text))||(ts.isElementAccessExpression(n.expression)&&['from','rpc'].includes(constantString(n.expression.argumentExpression,constants))))) {
        if(ts.isIdentifier(n.expression.expression)&&/^(Array|Buffer|Uint\d+Array|Int\d+Array|Float\d+Array)$/.test(n.expression.expression.text))return
        const arg=n.arguments[0]
        const target=constantString(arg,constants)
        if(target!==null&&/^csat_/i.test(target)&&!objectNames.has(target)&&!policy?.object_approvals?.[target]?.review_basis)issues.push({file:rel,kind:'unclassified_csat_object',object:target})
        if(target!==null&&(names.has(target)||/^csat_/i.test(target)&&!objectNames.has(target))){hits.push(target);register(n)}
        else if(target===null){hits.push('<dynamic-db-name>');register(n)}
      }
      if(rel.startsWith('app/api/csat/')&&ts.isFunctionDeclaration(n)&&n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)&&/^(GET|POST|PUT|PATCH|DELETE)$/.test(n.name?.text??''))register(n)
      if(rel.startsWith('app/api/csat/')&&ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&/^(GET|POST|PUT|PATCH|DELETE)$/.test(n.name.text)&&n.initializer&&ts.isArrowFunction(n.initializer)&&n.parent.parent.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))register(n.initializer)
      if(ts.isCallExpression(n)&&((ts.isIdentifier(n.expression)&&/^(readFile|readFileSync)$/.test(n.expression.text))||(ts.isPropertyAccessExpression(n.expression)&&/^(readFile|readFileSync)$/.test(n.expression.name.text)))) {
        register(n)
        register(source)
        if(!manifest.app_file_loaders?.[rel]&&!loader(rel))issues.push({file:rel,kind:'unclassified_file_loader'})
      }
      if(dependency?.endsWith('.json')) {
        register(n)
        register(source)
        if(!manifest.app_json_imports?.[rel]&&!loader(rel))issues.push({file:rel,kind:'unclassified_json_loader'})
      }
    })
    // Protect helper/control-flow edits within an approved loader, not only its IO line.
    if(adminBoundary){callerClass='ADMIN_ONLY';register(source)}
    if(loader(rel)||manifest.app_file_loaders?.[rel]||manifest.app_json_imports?.[rel]||hits.length)register(source)
    const route=routePath.startsWith('app/api/csat/')&&/\/route\.[jt]sx?$/.test(rel)
    const page=routePath.startsWith('app/csat/')&&/\/page\.[jt]sx?$/.test(rel)
    if(page){const classification=manifest.app_pages?.[rel.replace(/\/page\.[jt]sx?$/,'')]??policy?.page_classifications?.[rel];if(!classification)issues.push({file:rel,kind:'unclassified_page'});register(source)}
    if(route){register(source);if(!manifest.app_api[routePath.replace(/^app\/api\//,'').replace(/\/route\.[jt]sx?$/,'')])issues.push({file:rel,kind:'unclassified_route'})}
    if(hits.length) {
      discovered.push({file:rel,surfaces:[...new Set(hits)]})
      if(!loader(rel)) issues.push({file:rel,kind:'unclassified_loader',surfaces:[...new Set(hits)]})
    }
    if(['ANSWER_SENSITIVE','CORRECTNESS'].includes(loader(rel)?.class)) {
      let called=false
      visit(source,n=>{
        if(!ts.isCallExpression(n))return
        if(ts.isIdentifier(n.expression)&&imported.has(n.expression.text))called=true
        if(ts.isPropertyAccessExpression(n.expression)&&ts.isIdentifier(n.expression.expression)&&namespaces.has(n.expression.expression.text)&&GATE.has(n.expression.name.text))called=true
      })
      if(!called)issues.push({file:rel,kind:'ungated_loader'})
    }
  }
  for(const file of Object.keys(manifest.app_db_loaders??{})) if(!fs.existsSync(path.join(srcRoot,file)))issues.push({file,kind:'stale_loader'})
  if(policy)for(const row of functions.values()) {
    const approval=policy.function_approvals?.[row.key]
    if(!approval||approval.sha256!==row.sha256||approval.class!==row.class||!approval.review_basis)issues.push({file:row.file,function:row.function,kind:'unclassified_or_changed_sensitive_function'})
  }
  return {discovered,functions:[...functions.values()],issues,limitation:'AST discoveries and reviewed function bodies fail on new/changed sensitive reads and CSAT handlers. Approved code still needs behavioral tests and trust-boundary review; this is not a complete interprocedural proof.'}
}

export function secretLiterals(file,text,canaries=[]) {
  const found=[]
  if(canaries.some(c=>text.includes(c)))found.push('canary')
  if(file.endsWith('.json')) {
    let value;try{value=JSON.parse(text)}catch{return ['invalid_json']}
    const walk=v=>{if(!v||typeof v!=='object')return;if(typeof v.item_id==='string'&&v.item_id.includes('#')&&typeof v.choice==='number'&&(typeof v.tempting==='string'||typeof v.reject==='string'))found.push('trap_example');const identity=v.item_id??v.id??v.exam_id;if(typeof identity==='string'&&(identity.includes('#')||/^[A-Za-z]?\d{4}[A-Za-z]?$/.test(identity)))for(const key of ['answer','answers','answer_key','is_correct','raw_score','correct','wrong'])if(v[key]!=null)found.push(key);for(const[k,x]of Object.entries(v)){if(SECRET.test(k)&&x!==null&&(typeof x!=='object'||Object.keys(x).length))found.push(k);walk(x)}}
    walk(value)
  } else {
    visit(parse(file,text),n=>{
      if(ts.isObjectLiteralExpression(n)) {
        const values=new Map(n.properties.filter(ts.isPropertyAssignment).map(p=>[property(p.name),p.initializer]))
        const item=values.get('item_id'),choice=values.get('choice')
        const identifier=item??values.get('id')??values.get('exam_id')
        if(identifier&&ts.isStringLiteralLike(identifier)&&(identifier.text.includes('#')||/^[A-Za-z]?\d{4}[A-Za-z]?$/.test(identifier.text)))for(const key of ['answer','answers','answer_key','is_correct','raw_score','correct','wrong'])if(values.has(key))found.push(key)
        if(item&&ts.isStringLiteralLike(item)&&item.text.includes('#')&&choice&&ts.isNumericLiteral(choice)&&['tempting','reject'].some(k=>values.has(k)))found.push('trap_example')
      }
      if(ts.isPropertyAssignment(n)&&SECRET.test(property(n.name)??'')&&(ts.isStringLiteralLike(n.initializer)||ts.isNumericLiteral(n.initializer)||ts.isArrayLiteralExpression(n.initializer)||ts.isObjectLiteralExpression(n.initializer)))found.push(property(n.name))
      if(ts.isStringLiteralLike(n)&&canaries.some(c=>n.text.includes(c)))found.push('canary')
      // Webpack serializes imported JSON inside decoded JavaScript strings.
      if(ts.isStringLiteralLike(n)&&/^\s*[\[{]/.test(n.text)) {
        try { JSON.parse(n.text); found.push(...secretLiterals('embedded.json',n.text,canaries)) } catch { /* Ordinary prose is not serialized JSON. */ }
      }
    })
  }
  return [...new Set(found)]
}

export function clientGraph(srcRoot) {
  srcRoot=path.resolve(srcRoot)
  const options={baseUrl:srcRoot,paths:{'@/*':['*']},allowJs:true,resolveJsonModule:true,moduleResolution:ts.ModuleResolutionKind.Bundler}
  const sources=filesUnder(srcRoot).filter(f=>/\.[jt]sx?$/.test(f)&&!f.endsWith('.d.ts'))
  const roots=sources.filter(file=>parse(file,fs.readFileSync(file,'utf8')).statements.some(n=>ts.isExpressionStatement(n)&&ts.isStringLiteral(n.expression)&&n.expression.text==='use client'))
  const seen=new Set(), unresolved=[]
  const walk=file=>{
    if(seen.has(file)||!file.startsWith(srcRoot+path.sep))return
    seen.add(file);if(file.endsWith('.json'))return
    const source=parse(file,fs.readFileSync(file,'utf8'))
    const load=specifier=>{
      if(/\.(css|scss|svg|png|jpg|webp)$/.test(specifier)) {
        const asset=specifier.startsWith('@/')?path.join(srcRoot,specifier.slice(2)):path.resolve(path.dirname(file),specifier)
        if(!fs.existsSync(asset))unresolved.push({file:relative(srcRoot,file),specifier})
        return
      }
      const result=ts.resolveModuleName(specifier,file,options,ts.sys).resolvedModule
      if(result&&!result.resolvedFileName.endsWith('.d.ts'))walk(path.resolve(result.resolvedFileName))
      else if(!result&&(specifier.startsWith('.')||specifier.startsWith('@/')))unresolved.push({file:relative(srcRoot,file),specifier})
    }
    visit(source,n=>{
      if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&!n.importClause?.isTypeOnly)load(n.moduleSpecifier.text)
      if(ts.isExportDeclaration(n)&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)&&!n.isTypeOnly)load(n.moduleSpecifier.text)
      if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')) {
        if(n.arguments[0]&&ts.isStringLiteralLike(n.arguments[0]))load(n.arguments[0].text)
        else unresolved.push({file:relative(srcRoot,file),specifier:'<dynamic-import>'})
      }
    })
  }
  roots.forEach(walk)
  return {roots:roots.map(f=>relative(srcRoot,f)),files:[...seen],unresolved}
}
export function scanClient(srcRoot, canaries=[]) {
  const graph=clientGraph(srcRoot),issues=[]
  for(const file of graph.files){const text=fs.readFileSync(file,'utf8');const hits=secretLiterals(file,text,canaries);if(hits.length)issues.push({file:relative(srcRoot,file),kind:'CLIENT_SECRET_LITERAL',keys:hits})}
  return {roots:graph.roots.length,files:graph.files.length,issues,unresolved:graph.unresolved}
}
export function scanBundle(directory,canaries=[]) {
  const files=filesUnder(directory,true).filter(f=>/\.(js|mjs|json|css|svg|html|map)$/.test(f)),issues=[]
  if(!files.length)issues.push({kind:'BUNDLE_NOT_EXECUTED'})
  for(const file of files){const hits=secretLiterals(file,fs.readFileSync(file,'utf8'),canaries);if(hits.length)issues.push({file:relative(directory,file),kind:'CLIENT_SECRET_LEAK',keys:hits})}
  return {files:files.length,issues}
}
export function pagingLocations(text,file) {
  const out=[],source=parse(file,text)
  visit(source,n=>{if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='range'&&n.arguments[0]&&!ts.isNumericLiteral(n.arguments[0]))out.push({file,line:source.getLineAndCharacterOfPosition(n.getStart(source)).line+1,key:file+'|'+n.getText(source).replace(/\s+/g,' ')})})
  return out
}
export function migrationCoverage(repo,baseRef,approved={}) {
  const git=args=>{const r=spawnSync('git',args,{cwd:repo,encoding:'utf8'});if(r.status!==0)throw Error('Cannot discover migration changes');return r.stdout.trim().split(/\r?\n/).filter(Boolean)}
  const files=[...new Set([...git(['diff','--name-only',baseRef,'HEAD','--','supabase/migrations']),...git(['diff','--name-only','HEAD','--','supabase/migrations']),...git(['ls-files','--others','--exclude-standard','supabase/migrations'])])]
  const related=files.filter(file=>/\.sql$/.test(file)&&(!fs.existsSync(path.join(repo,file))||/csat_|\b(?:grant|revoke)\b[^;]*\ball\s+(?:tables|functions|procedures|sequences|routines)\s+in\s+schema\b|\balter\s+default\s+privileges\b|\b(?:alter|create|drop)\s+role\b|\bgrant\s+(?:service_role|authenticated|anon)\s+to\b/i.test(fs.readFileSync(path.join(repo,file),'utf8').replace(/"/g,''))))
  const checked=[...new Set([...related,...Object.keys(approved)])]
  const issues=checked.flatMap(file=>{if(!/^supabase\/migrations\/\d+_[^/]+\.sql$/.test(file)||!fs.existsSync(path.join(repo,file)))return[{file,reason:'related_migration_deleted_or_invalid'}];const hash=createHash('sha256').update(fs.readFileSync(path.join(repo,file))).digest('hex');return approved[file]?.sha256===hash&&approved[file]?.review_basis?[]:[{file,reason:'related_migration_not_bound_to_executed_sql_suite'}]})
  return{base_ref:baseRef,related,issues,policy:'New/changed CSAT SQL cannot be green until its exact hash is bound to a runner that applies and tests it.'}
}
export function pagingDiff(repo,baseRef,allowlist=[]) {
  const git=args=>{const r=spawnSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:128*1024*1024});if(r.status!==0)throw Error('Cannot read paging base revision');return r.stdout}
  const baseFiles=git(['ls-tree','-r','-z','--name-only',baseRef]).split('\0').filter(f=>/^(apps\/web\/src|scripts|packages)\//.test(f)&&/\.(ts|tsx|js|mjs|mts)$/.test(f)&&!/(?:__tests__|\.test\.|\.spec\.)/.test(f))
  const batch=spawnSync('git',['cat-file','--batch'],{cwd:repo,input:baseFiles.map(f=>baseRef+':'+f).join('\n')+'\n',maxBuffer:128*1024*1024})
  if(batch.status!==0)throw Error('Cannot read paging base blobs')
  let offset=0
  const before=baseFiles.flatMap(file=>{
    const end=batch.stdout.indexOf(10,offset),header=batch.stdout.subarray(offset,end).toString('utf8'),size=Number(header.split(' ')[2])
    if(end<0||!Number.isSafeInteger(size))throw Error('Invalid paging base blob')
    const text=batch.stdout.subarray(end+1,end+1+size).toString('utf8');offset=end+size+2
    return pagingLocations(text,file)
  })
  const after=['apps/web/src','scripts','packages'].flatMap(root=>filesUnder(path.join(repo,root))).filter(f=>/\.(ts|tsx|js|mjs|mts)$/.test(f)).flatMap(f=>pagingLocations(fs.readFileSync(f,'utf8'),relative(repo,f)))
  const difference=(a,b)=>{const counts=new Map();for(const r of b)counts.set(r.key,(counts.get(r.key)??0)+1);return a.filter(r=>{const n=counts.get(r.key)??0;if(n){counts.set(r.key,n-1);return false}return true})}
  const added=difference(after,before),removed=difference(before,after)
  const permitted=new Set(allowlist.filter(r=>r.decision&&r.reason).map(r=>r.key))
  return {base_ref:baseRef,before:before.length,after:after.length,added,removed,issues:after.length>before.length?added.filter(r=>!permitted.has(r.key)):[],unit:'AST range calls with nonliteral offset; net growth requires recorded architecture decisions. Added and removed sites are always reported.'}
}
