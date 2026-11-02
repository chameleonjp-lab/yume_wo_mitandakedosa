'use strict';
const {readFileSync}=require('node:fs');const {join}=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
function extract(name){const m=html.match(new RegExp('^      (?:async )?function '+name+'\\([^\\n]*\\) \\{\\n[\\s\\S]*?^      \\}','m'));assert.ok(m,name);return m[0];}
const retry=html.match(/document.getElementById\("rankingRetryButton"\).addEventListener\("click", \(\) => \{([^\n]+)\}\);/);assert.ok(retry);
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script(readFileSync(join(__dirname,'../normal-score-ack8.js'),'utf8')+'\n'+['submitScoreAndLoadRanking','requestRankingsForResult','loadRankingLists','renderRankingReadState','normalizeRpcRow','pickField'].map(extract).join('\n')+`
let state={scoreSubmitted:false},rankingReadVersion=0,lastResult=null,calls=[],mode='normal',deferSubmit=true,resolveSubmit;
const SCORE_ORDER='desc',GAME_SLUG='yume_wo_mitandakedosa',CLIENT_VERSION='yume-mitandakedosa-ranking-v1',SCORE_SCALE=1;
const nodes={rankingReadStatus:{textContent:''},rankingRetryButton:{disabled:false}};
const document={getElementById(id){return nodes[id];}};
const rankingSubmitStatus={textContent:''},rankingSummary={innerHTML:''},rankingList={innerHTML:''};
function t(key){return key;}
function renderRankingUnavailable(text){rankingSubmitStatus.textContent=text;}
function renderRankingSummary(){}function renderRankingList(){}
const response={data:[{accepted:true,result_normalized_name:'Alice',result_display_name:'Alice',result_first_score:100,result_best_score:100,result_play_count:1,is_first_play:true,is_new_best:true}],error:null};
function getSupabaseClient(){
 if(mode==='sdkthrow')throw Error('SDK initialization failed');
 return {rpc(name,args){calls.push([name,args]);
 if(name==='submit_score')return deferSubmit?new Promise(resolve=>{resolveSubmit=resolve;}):Promise.resolve(response);
 if(!['get_best_score_ranking','get_first_try_ranking'].includes(name))throw Error('unexpected RPC');
 if(mode==='readFail')return Promise.reject(Error('read failure'));
 return Promise.resolve({data:[],error:null});
 }};
}
function retryClick(){${retry[1]}}
function fresh(){state={scoreSubmitted:false};lastResult={resultType:'clear',score:100,participation:{name:'Alice',participates:true}};calls=[];}
`).runInContext(context,{timeout:1000});
const run=s=>new vm.Script(s).runInContext(context,{timeout:1000});
const value=s=>JSON.parse(run('JSON.stringify('+s+')'));
(async()=>{
 run('fresh();');const submit=run('submitScoreAndLoadRanking(lastResult)');
 assert.deepEqual(value('calls.map(x=>x[0])'),['submit_score']);
 run('resolveSubmit(response);');await submit;
 assert.deepEqual(value('calls.map(x=>x[0])'),['submit_score','get_best_score_ranking','get_first_try_ranking']);
 run('calls=[];retryClick();');await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.deepEqual(value('calls.map(x=>x[0])'),['get_best_score_ranking','get_first_try_ranking']);
 run("fresh();deferSubmit=false;mode='readFail';");await run('submitScoreAndLoadRanking(lastResult)');
 assert.equal(run('lastResult.deliveryKey'),'sent');assert.equal(run('lastResult.rankingState'),'failed');
 console.log('PASS: named-submit/read ordering, actual retry caller read-only, read failure does not relabel delivery');
 run("fresh();mode='sdkthrow';");
 await assert.doesNotReject(run('submitScoreAndLoadRanking(lastResult)'),'SDK failure must remain nonblocking and update status');
 assert.equal(run('lastResult.deliveryKey'),'rankingUnavailable');assert.equal(run('state.scoreSubmitted'),false);assert.equal(run('lastResult.score'),100);
 console.log('PASS: SDK creation failure keeps result and marks unavailable without score submission');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
