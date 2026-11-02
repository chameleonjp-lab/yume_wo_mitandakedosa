'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script(readFileSync(join(__dirname,'../common-state.js'),'utf8')).runInContext(context,{timeout:1000});
const api = context.YumeCommonState;
assert.equal(api.snapshotParticipation('  ').participates,false);
assert.equal(api.snapshotParticipation('Alice').name,'Alice');
const snapshot=api.snapshotParticipation('Alice');
assert.equal(Object.isFrozen(snapshot),true);
const values=new Map();
const key='yume_mitandakedosa_result_v1';
const storage={getItem(key){return values.has(key)?values.get(key):null;},setItem(key,value){values.set(key,value);}};
const result={resultType:'clear',score:-500,elapsed:60,timeLeft:0,survivalScore:6000,survivalSeconds:60,stats:{blueHits:1,redDestroyed:0,redMissed:0,redHits:0,satelliteTapped:0,satelliteMissed:0,sakeCaught:0,sakeMissed:0}};
assert.equal(api.retainResult(storage,result,snapshot,'uncertain').saved,true);
result.score=900;
assert.equal(api.readRetainedResult(storage).record.result.score,-500);
assert.equal(api.readRetainedResult(storage).record.delivery,'uncertain');
assert.equal(api.retainResult({setItem(){throw Error('denied');}},result,snapshot,'failed').saved,false);
values.set(key,'broken');assert.equal(api.readRetainedResult(storage).status,'unavailable');assert.equal(values.get(key),'broken');
assert.equal(api.retainResult(storage,result,snapshot,'failed').saved,true);assert.equal(values.get(key+'_archive_1'),'broken');
values.set(key,'{}');assert.equal(api.readRetainedResult(storage).status,'invalid');assert.equal(values.get(key),'{}');
assert.equal(api.retainResult({setItem(){},getItem(){return null;}},result,snapshot,'pending').saved,false);
console.log('PASS: optional name snapshot, signed result retention/readback, storage failure, no corrupt-data deletion');

const circular={};circular.self=circular;
assert.equal(api.retainResult(storage,circular,snapshot,'pending').saved,false);
assert.equal(api.retainResult(storage,{score:1n},snapshot,'pending').saved,false);
assert.equal(api.retainResult(storage,{get score(){throw Error('getter');}},snapshot,'pending').saved,false);
assert.equal(api.retainResult({getItem(){throw Error('denied');}},result,snapshot,'failed').saved,false);
const quota={getItem(){return 'older';},setItem(){throw Error('quota');}};
assert.equal(api.retainResult(quota,result,snapshot,'failed').saved,false);
console.log('PASS: serialization/getter/quota failures remain non-blocking');
for(const mutate of [
 r=>{r.stats.blueHits=-1;},r=>{r.stats.redDestroyed=0.5;},r=>{delete r.stats.satelliteMissed;},
 r=>{r.timeLeft=Infinity;},r=>{r.elapsed=NaN;},r=>{r.elapsed=-1;},r=>{r.score=0.5;},
 r=>{r.survivalScore=-1;},r=>{r.survivalSeconds=-1;},r=>{r.survivalSeconds=0.5;}
]){
 const malformed=JSON.parse(JSON.stringify(result));mutate(malformed);
 const raw=JSON.stringify({version:1,result:malformed,participation:snapshot,delivery:'uncertain'});
 values.set(key,raw);
 assert.equal(api.readRetainedResult(storage).status,'invalid');
 assert.equal(values.get(key),raw,'invalid original must remain untouched');
}
console.log('PASS: malformed count/time/score/survival schema table leaves original bytes untouched');
