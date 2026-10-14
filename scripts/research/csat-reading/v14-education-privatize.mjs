// scripts/research/csat-reading/v14-education-privatize.mjs
// One-time migration before publication; preserves detailed bytes in ignored storage.
import fs from 'node:fs';
const codePath='scripts/research/csat-reading/v14-education.mjs',local='scripts/research/csat-reading/local/v14/',publicPath='docs/research/csat-reading/data/v14/education-packages.json';
const code=fs.readFileSync(codePath,'utf8'),start=code.indexOf('const specifications=['),end=code.indexOf('\nconst activities=',start);
if(start<0||end<0)throw Error('Already migrated or unexpected source');
const specifications=Function(code.slice(start,end)+';return specifications;')();
const target=local+'education-specifications.json';if(fs.existsSync(target))throw Error('Private specs already exist');
fs.writeFileSync(target,JSON.stringify(specifications,null,2)+'\n');
fs.writeFileSync(local+'education-packages.json',fs.readFileSync(publicPath));
fs.writeFileSync(codePath,code.slice(0,start)+"const specifications=read(local+'v14/education-specifications.json');"+code.slice(end));
console.log('Detailed specifications and first package bytes preserved in ignored local storage; public generator now uses private source input.');
