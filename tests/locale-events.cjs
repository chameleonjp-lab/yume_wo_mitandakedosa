'use strict';
const {readFileSync}=require('node:fs');const {join}=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
const raw=readFileSync(join(__dirname,'../i18n-dictionary.js'),'utf8');
const dictionaries=JSON.parse(raw.slice('globalThis.YumeDictionary = '.length).trim().replace(/;$/,''));
const countdown=html.match(/^      function showCountdown\(text\) \{\n[\s\S]*?^      \}/m);assert.ok(countdown);
const event=html.match(/^      function showEventToast\(key\) \{ ([^\n]+) \}/m);assert.ok(event);
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script(countdown[0]+'\n'+event[0]+`
let dictionary={},events=[],toasts=[];
const sound={play(key){events.push(key);}};
const countdownOverlay={textContent:'',offsetWidth:100,classList:{add(){},remove(){}}};
function t(key){return dictionary[key];}function showToast(value){toasts.push(value);}
`).runInContext(context,{timeout:1000});
for(const [lang,dictionary] of Object.entries(dictionaries)){
 context.inputDictionary=dictionary;
 new vm.Script('dictionary=inputDictionary;events=[];toasts=[];showCountdown(3);').runInContext(context,{timeout:1000});
 assert.equal(context.countdownOverlay,undefined); // Lexical bindings remain inside the VM.
 assert.equal(new vm.Script('countdownOverlay.textContent').runInContext(context,{timeout:1000}),3);
 new vm.Script('showCountdown("start");showEventToast("redBroken");showEventToast("satelliteBonus");').runInContext(context,{timeout:1000});
 assert.equal(new vm.Script('countdownOverlay.textContent').runInContext(context,{timeout:1000}),dictionary.start,lang);
 assert.deepEqual(JSON.parse(new vm.Script('JSON.stringify(toasts)').runInContext(context,{timeout:1000})),[dictionary.redBroken,dictionary.satelliteBonus]);
}
assert.ok(html.includes('showEventToast("redBroken");'));assert.ok(html.includes('showEventToast("satelliteBonus");'));
console.log('PASS: 15-locale countdown and event semantics, numeric countdown unchanged, no timer/clock execution');
