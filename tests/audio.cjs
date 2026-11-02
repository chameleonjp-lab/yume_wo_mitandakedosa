'use strict';
const {readFileSync}=require('node:fs');const {join}=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const sandbox=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script(readFileSync(join(__dirname,'../audio.js'),'utf8')).runInContext(sandbox,{timeout:1000});
const factory=sandbox.YumeAudio.createAudio;
function harness(saved){
 let time=1000,created=0,started=0;const nodes=[];
 const parameter={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
 const context={state:'running',currentTime:0,destination:{},resume(){this.state='running';return Promise.resolve();},suspend(){this.state='suspended';return Promise.resolve();},
 createOscillator(){const node={frequency:parameter,connect(){},disconnect(){},start(){started++;},stop(){}};nodes.push(node);return node;},createGain(){return {gain:parameter,connect(){},disconnect(){}};}};
 const storage={getItem(){return saved;},setItem(key,value){saved=value;}};
 const audio=factory({storage,createContext(){created++;return context;},now:()=>time});
 return {audio,nodes,context,advance(){time+=200;},created:()=>created,started:()=>started};
}
let h=harness(null);assert.equal(h.audio.getState().enabled,true);assert.ok(h.audio.getState().volume>0);assert.equal(h.created(),0);
h.audio.gesture();assert.equal(h.created(),1);assert.equal(h.audio.play('hit'),true);assert.equal(h.audio.play('hit'),false);assert.equal(h.audio.play('select'),false);
h.audio.setEnabled(false);assert.equal(h.audio.play('hit'),false);h.audio.setEnabled(true);h.advance();assert.equal(h.audio.play('pickup'),true);
h.audio.visibility(true);assert.equal(h.audio.play('clear'),false);h.audio.visibility(false);assert.equal(h.audio.play('clear'),false);h.audio.gesture();h.advance();assert.equal(h.audio.play('clear'),true);
h=harness(JSON.stringify({enabled:false,volume:0}));h.audio.gesture();assert.equal(h.created(),0);assert.equal(h.audio.getState().volume,0);
h=harness(null);h.audio.setEnabled(false);h.audio.gesture();assert.equal(h.created(),0);
h=harness(null);h.audio.gesture();h.audio.setVolume(0);assert.equal(h.audio.play('start'),false);assert.equal(h.audio.setVolume(NaN),false);
const fail=factory({storage:{getItem(){throw Error('storage');},setItem(){throw Error('quota');}},createContext(){throw Error('audio');},now:()=>0});
assert.doesNotThrow(()=>fail.gesture());assert.equal(fail.play('start'),false);assert.equal(fail.setEnabled(false),false);
console.log('PASS: default on/nonzero, stored off/zero, gesture/mute order, no queued recovery, priority/cooldown, failure nonblocking');

let resumes=0;
const pendingContext={state:'suspended',resume(){resumes++;return new Promise(()=>{});},suspend(){return Promise.resolve();}};
const pending=factory({storage:{getItem(){return null;},setItem(){}},createContext:()=>pendingContext,now:()=>0});
pending.gesture('first');pending.gesture('first');assert.equal(resumes,1);
pending.gesture('second');assert.equal(resumes,2);
pending.visibility(true);pending.setEnabled(false);pending.visibility(false);pending.gesture('third');assert.equal(resumes,2);
pending.setEnabled(true);pending.gesture('fourth');assert.equal(resumes,3);
pendingContext.resume=()=>{resumes++;return Promise.reject(Error('resume rejected'));};
pending.gesture('fifth');pending.gesture('sixth');assert.equal(resumes,5);
for(const failure of ['createGain','start','stop']){
 let disconnected=0,failNow=true;
 const param={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
 const fake={state:'running',currentTime:0,destination:{},createOscillator(){return {frequency:param,connect(){},disconnect(){disconnected++;},start(){if(failNow&&failure==='start')throw Error('start');},stop(){if(failNow&&failure==='stop')throw Error('stop');}};},createGain(){if(failNow&&failure==='createGain')throw Error('gain');return {gain:param,connect(){},disconnect(){disconnected++;}};}};
 const a=factory({storage:{getItem(){return null;},setItem(){}},createContext:()=>fake,now:()=>1000});
 a.gesture();assert.equal(a.play('hit'),false);assert.ok(disconnected>=1);
 failNow=false;assert.equal(a.play('select'),true,'failed high-priority voice must not remain');a.stop();
}
console.log('PASS: pending/rejected resume retries, same-gesture guard, visibility/mute order and partial-node cleanup');
