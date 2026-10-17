import {performance} from 'node:perf_hooks';
import {analyzeReconciliation} from '../src/analyze.js';
let seed=42;
const transactions=Array.from({length:1000},(_,i)=>{
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  return {id:`synthetic-${i}`,date:'2026-10-01',amount:((seed%100000)-75000)*10,cleared:'uncleared'};
});
const snapshot={account:{id:'benchmark',type:'checking',cleared_balance:0,uncleared_balance:transactions.reduce((s,t)=>s+t.amount,0)},transactions,history_complete:true};
const start=performance.now();
const result=analyzeReconciliation({snapshot,bank_balance:'123.45'});
console.log(JSON.stringify({node:process.version,transactions:transactions.length,elapsed_ms:Math.round(performance.now()-start),search:result.search,candidate_count:result.candidates.length}));
if (result.search.complete) throw new Error('Benchmark expected the bounded-search limit to be exercised');
