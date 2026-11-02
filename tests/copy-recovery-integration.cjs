'use strict';
const {readFileSync}=require('node:fs');const {join}=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
function extract(name){const m=html.match(new RegExp('^      function '+name+'\\([^\\n]*\\) \\{\\n[\\s\\S]*?^      \\}','m'));assert.ok(m,name);return m[0];}
const restore=html.match(/restoreButton.addEventListener\("click", \(\) => \{([\s\S]*?)\n      \}\);/);assert.ok(restore);
const escape=html.match(/document.getElementById\("copyPanel"\).addEventListener\("keydown", event => \{([\s\S]*?)\n      \}\);/);assert.ok(escape);
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script(['copyText','fallbackCopy','closeCopyPanel'].map(extract).join('\n')+`
let trace=[],lastResult=null,record={status:'available',record:{result:{resultType:'clear',score:-500,stats:{}},participation:{name:'Alice',participates:true}}};
const nodes={copyPanel:{hidden:true},copyPanelText:{value:'',focus(){trace.push('focusArea');},select(){trace.push('select');}},resultStorage:{textContent:''}};
const document={getElementById(id){return nodes[id];}};const window={isSecureContext:true};
const navigator={clipboard:{writeText(){return Promise.resolve();}}};
function showToast(value){trace.push(value);}function t(key){return key;}
const sound={play(key){trace.push(key);}};const shareFocusTarget={isConnected:true,focus(){trace.push('focusShare');}};
const YumeCommonState={readRetainedResult(){return record;}};const clientStorage={};
async function requestRankingsForResult(){trace.push('readOnlyRanking');}
function refreshRecovery(){trace.push('refresh');}function stopLoop(){trace.push('stop');}function clearEntities(){trace.push('clearDOM');}
function renderResult(){trace.push('render');}function showScreen(){trace.push('screen');}const resultScreen={};const rankingSubmitStatus={textContent:''};
function restoreResult(){${restore[1]}
}
function escapePanel(event){${escape[1]}
}
`).runInContext(context,{timeout:1000});
const run=s=>new vm.Script(s).runInContext(context,{timeout:1000});
const value=s=>JSON.parse(run('JSON.stringify('+s+')'));
(async()=>{
 await run('copyText("body")');assert.equal(run('nodes.copyPanel.hidden'),true);assert.deepEqual(value('trace'),['copied']);
 run('trace=[];navigator.clipboard.writeText=()=>Promise.reject(Error("denied"));');await run('copyText("manual body")');
 assert.equal(run('nodes.copyPanel.hidden'),false);assert.equal(run('nodes.copyPanelText.value'),'manual body');
 run('escapePanel({key:"Escape",preventDefault(){trace.push("prevent");}});');assert.equal(run('nodes.copyPanel.hidden'),true);assert.equal(run('trace.at(-1)'),'focusShare');
 run('trace=[];navigator.clipboard.writeText=()=>{throw Error("sync denied");};');await run('copyText("sync body")');assert.equal(run('nodes.copyPanelText.value'),'sync body');
 run('trace=[];restoreResult();');assert.equal(run('lastResult.score'),-500);assert.equal(run('lastResult.participation.name'),'Alice');
 assert.equal(run('lastResult.deliveryKey'),'restored');assert.equal(run('rankingSubmitStatus.textContent'),'restored');
 assert.deepEqual(value('trace'),['stop','clearDOM','render','screen','readOnlyRanking']);
 run('trace=[];record={status:"invalid"};restoreResult();');assert.deepEqual(value('trace'),['refresh']);
 console.log('PASS: actual copy success/reject/throw, manual Escape/focus return, local restore read-only/no submit path, invalid record preserved');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
