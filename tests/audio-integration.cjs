'use strict';
const {readFileSync}=require('node:fs');const {join}=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
function body(pattern){const m=html.match(pattern);assert.ok(m,String(pattern));return m[1];}
const change=body(/soundEnabled.addEventListener\("change", event => \{([^\n]+)\}\);/);
const volume=body(/soundVolume.addEventListener\("input", event => \{([^\n]+)\}\);/);
const click=body(/document.addEventListener\("click", event => \{([\s\S]*?)\n      \}, true\);/);
const pointer=body(/stage.addEventListener\("pointerdown", event => ([^\n]+), true\);/);
const visibility=body(/document.addEventListener\("visibilitychange", \(\) => ([^\n]+)\);/);
const blur=body(/window.addEventListener\("blur", \(\) => ([^\n]+)\);/);
const focus=body(/window.addEventListener\("focus", \(\) => ([^\n]+)\);/);
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script(`
let trace=[];const scoreSnapshot={score:-500,timeLeft:12};
const sound={setEnabled(value){trace.push(['enabled',value]);},setVolume(value){trace.push(['volume',value]);},gesture(event){trace.push(['gesture',event.token]);},play(event){trace.push(['play',event]);},visibility(value){trace.push(['visibility',value]);}};
const soundEnabled={checked:false},soundVolume={value:'0'};
const stage={contains(target){return target.inStage===true;}};const document={hidden:false};
function onChange(event){${change}}
function onVolume(event){${volume}}
function onClick(event){${click}}
function onPointer(event){${pointer}}
function onVisibility(){${visibility}}
function onBlur(){${blur}}
function onFocus(){${focus}}
`).runInContext(context,{timeout:1000});
const run=s=>new vm.Script(s).runInContext(context,{timeout:1000});
const value=s=>JSON.parse(run('JSON.stringify('+s+')'));
run("onChange({token:'mute'});onVolume({token:'zero'});");
assert.deepEqual(value('trace'),[['enabled',false],['gesture','mute'],['volume',0],['gesture','zero']]);
run("trace=[];onClick({token:'label',target:{closest(selector){return selector.startsWith('label')?{}:null;}}});onClick({token:'input',target:soundEnabled});onClick({token:'stageclick',target:{inStage:true,closest(){return null;}}});");
assert.deepEqual(value('trace'),[]);
run("onPointer({token:'pointer'});onClick({token:'button',target:{closest(selector){return selector.startsWith('label')?null:{};}}});");
assert.deepEqual(value('trace'),[['gesture','pointer'],['gesture','button'],['play','select']]);
run("trace=[];document.hidden=true;onVisibility();onBlur();document.hidden=false;onFocus();");
assert.deepEqual(value('trace'),[['visibility',true],['visibility',true],['visibility',false]]);
assert.deepEqual(value('scoreSnapshot'),{score:-500,timeLeft:12});
console.log('PASS: actual caller mute/zero-before-gesture, label/input skip, stage-only pointer gesture, no auto-resume on focus, score untouched');

run("trace=[];onClick({token:'copyclose',target:{id:'copyPanelClose',closest(selector){return selector.startsWith('label')?null:{};}}});");
assert.deepEqual(value('trace'),[['gesture','copyclose']],'close button must not play select before cancel');
