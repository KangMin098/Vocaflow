// scripts/research/factory-i0-277-independent/jobs.mjs
import {browserJobs} from '../lm-g1-5a-independent/runner-contract.mjs'
export function factoryBrowserJobs(base,local){
 return [...browserJobs(base,local),['t1-1440','scripts/research/lm-g1-1-independent/browser.mjs',['--base',base,'--width','1440','--evidence',local+'/t1-1440']]]
}
