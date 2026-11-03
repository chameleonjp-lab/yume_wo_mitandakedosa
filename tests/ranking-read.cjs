'use strict';
const {readFileSync}=require('node:fs');const {join}=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
function extract(name){const m=html.match(new RegExp('^      (?:async )?function '+name+'\\([^\\n]*\\) \\{\\n[\\s\\S]*?^      \\}','m'));assert.ok(m,name);return m[0];}
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script(['submitScoreAndLoadRanking','requestRankingsForResult','loadRankingLists','renderRankingReadState','normalizeRpcRow','pickField'].map(extract).join('\n')+`
let state={scoreSubmitted:false},rankingReadVersion=0,lastResult=null,calls=[],paint=[],pending=[],mode='success';
const SCORE_ORDER='desc',GAME_SLUG='yume_wo_mitandakedosa',CLIENT_VERSION='yume-mitandakedosa-ranking-v1',SCORE_SCALE=1;
const nodes={rankingReadStatus:{textContent:''},rankingRetryButton:{disabled:false}};
const document={getElementById(id){return nodes[id];}};
const rankingSubmitStatus={textContent:''},rankingSummary={innerHTML:''},rankingList={innerHTML:''};
function t(key){return key;}
function renderRankingUnavailable(text){rankingSubmitStatus.textContent=text;}
function renderRankingSummary(){paint.push('summary');}
function renderRankingList(){paint.push('list');}
function getSupabaseClient(){return {rpc(name,args){
 calls.push([name,args]);
 if(!['get_best_score_ranking','get_first_try_ranking'].includes(name))throw Error('unexpected write');
 if(mode==='failure')return Promise.reject(Error('read failure'));
 if(mode==='pending')return new Promise(resolve=>pending.push(resolve));
 return Promise.resolve({data:[],error:null});
}};}
`).runInContext(context,{timeout:1000});
const run=s=>new vm.Script(s).runInContext(context,{timeout:1000});
const value=s=>JSON.parse(run('JSON.stringify('+s+')'));
(async()=>{
 for(const kind of ['clear','retire']){
  context.kind=kind;
  run("calls=[];lastResult={resultType:kind,score:-500,participation:{name:'',participates:false}};");
  await run('submitScoreAndLoadRanking(lastResult)');
  assert.deepEqual(value('calls'),[['get_best_score_ranking',{p_game_slug:'yume_wo_mitandakedosa',p_limit:30}],['get_first_try_ranking',{p_game_slug:'yume_wo_mitandakedosa',p_limit:30}]]);
  assert.equal(run('lastResult.rankingState'),'ready');assert.equal(run('lastResult.score'),-500);
 }
 run("mode='failure';lastResult.deliveryKey='anonymous';");await run('requestRankingsForResult(lastResult)');
 assert.equal(run('lastResult.rankingState'),'failed');assert.equal(run('lastResult.deliveryKey'),'anonymous');assert.equal(run('nodes.rankingRetryButton.disabled'),false);
 run("mode='success';");await run('requestRankingsForResult(lastResult)');assert.equal(run('lastResult.rankingState'),'ready');
 run("mode='pending';pending=[];paint=[];");const older=run('requestRankingsForResult(lastResult)');const newer=run('requestRankingsForResult(lastResult)');
 run("pending[2]({data:[{display_name:'LATEST'}],error:null});pending[3]({data:[],error:null});");await newer;
 run("pending[0]({data:[{display_name:'OLD'}],error:null});pending[1]({data:[],error:null});");await older;
 assert.equal(run('lastResult.bestRanking[0].display_name'),'LATEST');assert.deepEqual(value('paint'),['list']);
 run('pending=[];paint=[];');const previousPlay=run('requestRankingsForResult(lastResult)');
 run("lastResult={resultType:'clear',score:123};pending[0]({data:[{display_name:'OLD'}],error:null});pending[1]({data:[],error:null});");await previousPlay;
 assert.deepEqual(value('paint'),[]);assert.equal(run('lastResult.score'),123);
 console.log('PASS: anonymous/retire use only existing read RPC args, failure/retry independent of delivery, newest-read/new-play guards, no write');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
