// scripts/research/lm-w1/geometry.mjs
// Same eight measured contracts as scripts/design/ref-compare.mjs, on the owned authenticated page.
export async function geometry(page,spec){
 const data=await page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,w:r.width,h:r.height};};
  const heads=[...document.querySelectorAll('[data-testid=umap-domain]')];
  return {nodes:[...document.querySelectorAll('[data-testid=umap-node]')].map(e=>({code:e.getAttribute('data-node'),...rect(e)})),head:heads[0]?rect(heads[0]):null,headText:heads.map(e=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect().left+scrollX;}),layerXs:[...document.querySelectorAll('section[data-domain]')].map(e=>rect(e).x)};
 });
 const median=a=>a.length?[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)]:NaN;
 const mode=a=>[...a.reduce((m,n)=>m.set(n,(m.get(n)??0)+1),new Map())].sort((a,b)=>b[1]-a[1])[0]?.[0]??NaN;
 const xs=[...new Set(data.nodes.map(n=>Math.round(n.x)))].sort((a,b)=>a-b);
 const lx=Math.round(data.nodes.find(n=>n.code==='r.reference')?.x??NaN);
 const col=data.nodes.filter(n=>Math.round(n.x)===lx).sort((a,b)=>a.y-b.y);
 const rows=[
  ['노드 폭',spec.node.w,median(data.nodes.map(n=>n.w))],
  ['노드 높이',spec.node.h,median(data.nodes.map(n=>n.h))],
  ['열 피치',spec.columns.pitch,median(xs.slice(1).map((x,i)=>x-xs[i]))],
  ['행 피치',spec.rows.pitch,mode(col.slice(1).map((n,i)=>Math.round(n.y-col[i].y)))],
  ['머리 줄 높이',spec.panel.headH,data.head?.h??NaN],
  ['머리 줄 → 첫 노드',spec.panel.firstGap,col[0]&&data.head?col[0].y-data.head.y-data.head.h:NaN],
  ['열 머리 글자 → 노드 열',spec.layout.headerTextOffset,median(data.layerXs.map((x,i)=>data.headText[i]-x))],
  ['열 머리 피치',spec.layout.headerPitch,median(data.headText.slice(1).map((x,i)=>x-data.headText[i]))],
 ].map(([name,reference,actual])=>({name,reference,actual,delta:actual-reference,ok:Number.isFinite(actual)&&Math.abs(actual-reference)<=2}));
 return {viewport:spec.image,rows,pass:rows.every(r=>r.ok)};
}
