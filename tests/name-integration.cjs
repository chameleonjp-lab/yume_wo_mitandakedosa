'use strict';
const {readFileSync}=require('node:fs');const {join}=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
const source=readFileSync(join(__dirname,'../common-state.js'),'utf8');
function extract(name){const m=html.match(new RegExp('^      (?:async )?function '+name+'\\([^\\n]*\\) \\{\\n[\\s\\S]*?^      \\}','m'));assert.ok(m,name);return m[0];}
const handler=html.match(/playerNameInput.addEventListener\("keydown", \(event\) => \{([\s\S]*?)\n      \}\);/);assert.ok(handler);
const sandbox=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
const code=source+'\n'+['defaultStats','makeState','getPlayerName','saveRankingName','handleStartButton','startGame','buildResult','submitScoreAndLoadRanking'].map(extract).join('\n')+`
let state=null,currentParticipation={name:'',participates:false},soundStats=null,warned=false;
let starts=0,saves=[],requests=0,lastResult=null;
const sound={stop(){},gesture(){}};
const playerNameInput={value:''};
const localStorage={setItem(key,value){saves.push([key,value]);}};const RANKING_NAME_KEY='yume_mitandakedosa_ranking_name_v1';
function stopLoop(){}function clearEntities(){}function showScreen(){starts++;}const gameScreen={};
function requestAnimationFrame(fn){} // No frame/timer invocation in this name-boundary test.
function getSupabaseClient(){requests++;throw Error('should not reach client for anonymous/retire');}
async function requestRankingsForResult(){}
function renderRankingUnavailable(){}function t(key){return key;}
function onKey(event){${handler[1]}}
`;
new vm.Script(code).runInContext(sandbox,{timeout:1000});
const run=expression=>new vm.Script(expression).runInContext(sandbox,{timeout:1000});
run(`playerNameInput.value='   ';handleStartButton();`);assert.equal(run('currentParticipation.participates'),false);assert.equal(run('saves.at(-1)[1]'),'');
run(`playerNameInput.value='Alice';handleStartButton();state.score=-500;lastResult=buildResult('clear');playerNameInput.value='Bob';`);
assert.equal(run('lastResult.participation.name'),'Alice');assert.equal(run('lastResult.score'),-500);assert.equal(run('Object.isFrozen(lastResult.participation)'),true);
const before=run('starts');
run(`onKey({key:'Enter',isComposing:true,keyCode:13,preventDefault(){throw Error('IME should not start');}});onKey({key:'Enter',isComposing:false,keyCode:229,preventDefault(){throw Error('IME should not start');}});`);
assert.equal(run('starts'),before);
run(`onKey({key:'Enter',isComposing:false,keyCode:13,preventDefault(){}});`);assert.equal(run('starts'),before+1);
(async()=>{
 await run(`submitScoreAndLoadRanking({resultType:'clear',participation:{name:'',participates:false}})`);
 await run(`submitScoreAndLoadRanking({resultType:'retire',participation:{name:'Alice',participates:true}})`);
 assert.equal(run('requests'),0);
 console.log('PASS: actual home/start snapshot, saved-name clearing, signed result, both IME guards, anonymous/retire no client');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
