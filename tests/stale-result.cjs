'use strict';
const {readFileSync}=require('node:fs');const {join}=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
function extract(name){const m=html.match(new RegExp('^      (?:async )?function '+name+'\\([^\\n]*\\) \\{\\n[\\s\\S]*?^      \\}','m'));assert.ok(m,name);return m[0];}
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script(['startGame','submitScoreAndLoadRanking','normalizeRpcRow','pickField','loadRankingLists'].map(extract).join('\n')+`
let state={scoreSubmitted:false},soundStats=null,warned=false,currentParticipation={name:'',participates:false};
let trace=[],resolveResponse,resolvers=[];
const oldResult={resultType:'clear',score:100,participation:{name:'Alice',participates:true}};let lastResult=oldResult;
const sound={stop(){}};const YumeCommonState={snapshotParticipation(name){return Object.freeze({name,participates:!!name});}};
function getPlayerName(){return 'Bob';}function saveRankingName(){}function stopLoop(){}function clearEntities(){}function showScreen(){}function requestAnimationFrame(){}
function makeState(){return {running:false,score:0,scoreSubmitted:false};}const gameScreen={};
function getSupabaseClient(){return {rpc(){return new Promise(resolve=>{resolveResponse=resolve;resolvers.push(resolve);});}};}
function resolveAllRanking(){for(const resolve of resolvers)resolve({data:[{rank:1}],error:null});resolvers=[];}
function t(key){return key;}const SCORE_SCALE=1,SCORE_ORDER='desc',GAME_SLUG='yume_wo_mitandakedosa',CLIENT_VERSION='yume-mitandakedosa-ranking-v1';
const rankingSubmitStatus={set textContent(value){trace.push(['status',value]);}};
const rankingSummary={innerHTML:''},rankingList={innerHTML:''};
function renderRankingUnavailable(value){trace.push(['unavailable',value]);}function renderRankingSummary(){trace.push(['summary']);}
function renderRankingList(){trace.push(['ranking']);}
async function requestRankingsForResult(){trace.push(['ranking']);}
`).runInContext(context,{timeout:1000});
const run=code=>new vm.Script(code).runInContext(context,{timeout:1000});
(async()=>{
 const pending=run('submitScoreAndLoadRanking(oldResult)');
 run('startGame();trace=[];resolveResponse({data:{result_first_score:100,result_best_score:100,result_play_count:1},error:null});');
 await pending;
 assert.deepEqual(JSON.parse(run('JSON.stringify(trace)')),[],'old result response must not repaint during a new play');
 assert.equal(run('currentParticipation.name'),'Bob');assert.equal(run('state.score'),0);
 run('state={scoreSubmitted:false};lastResult=oldResult;trace=[];');
 const rejected=run('submitScoreAndLoadRanking(oldResult)');
 run('startGame();trace=[];resolveResponse({data:null,error:new Error("offline")});');await rejected;
 assert.deepEqual(JSON.parse(run('JSON.stringify(trace)')),[],'old rejection must not repaint');
 run('lastResult=oldResult;trace=[];');
 const ranking=run('loadRankingLists(getSupabaseClient(),oldResult)');
 // Both fake RPCs await their own promise. Resolve each through an explicit list below.
 run('startGame();trace=[];resolveAllRanking();');await ranking;
 assert.deepEqual(JSON.parse(run('JSON.stringify(trace)')),[],'old ranking response must not repaint');
 console.log('PASS: old named result completion cannot repaint a newer play; new name/score unchanged');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
