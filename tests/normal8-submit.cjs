'use strict';
// Read-only test harness: selected real functions in a VM; fake RPC only, no network.
const {readFileSync,existsSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
function extract(name){const m=html.match(new RegExp('^      (?:async )?function '+name+'\\([^\\n]*\\) \\{\\n[\\s\\S]*?^      \\}','m'));assert.ok(m,name);return m[0];}
const validator=join(__dirname,'../normal-score-ack8.js');
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script((existsSync(validator)?readFileSync(validator,'utf8'):'')+'\n'+['submitScoreAndLoadRanking','normalizeRpcRow','pickField'].map(extract).join('\n')+`
const GAME_SLUG='yume_wo_mitandakedosa',SCORE_ORDER='desc',CLIENT_VERSION='yume-mitandakedosa-ranking-v1',SCORE_SCALE=1;
let state,lastResult,calls,paints,resolveSubmit,reads;
const rankingSubmitStatus={textContent:''},rankingSummary={innerHTML:''},rankingList={innerHTML:''};
function t(k){return k;}
function renderRankingUnavailable(text){rankingSubmitStatus.textContent=text;}
function renderRankingSummary(...values){paints.push(values);}
async function requestRankingsForResult(){reads++;}
function getSupabaseClient(){return {rpc(name,args){calls.push([name,args]);return new Promise(resolve=>{resolveSubmit=resolve;});}};}
function fresh(){state={scoreSubmitted:false};lastResult={resultType:'clear',score:100,participation:Object.freeze({name:'Alice',participates:true})};calls=[];paints=[];reads=0;rankingSubmitStatus.textContent='';}
`).runInContext(context,{timeout:1000});
const run=s=>new vm.Script(s).runInContext(context,{timeout:1000});
const value=s=>JSON.parse(run('JSON.stringify('+s+')'));
const accepted={accepted:true,result_normalized_name:'Alice',result_display_name:'Alice',result_first_score:100,result_best_score:100,result_play_count:1,is_first_play:true,is_new_best:true};
const cases=[];function test(name,fn){cases.push([name,fn]);}
async function deliver(data,error=null){context.reply={data,error};run('fresh()');const pending=run('submitScoreAndLoadRanking(lastResult)');run('resolveSubmit(reply)');await pending;}
test('malformed normal response never displays sent and is not automatically resubmitted',async()=>{
 const wrongName={...accepted,result_display_name:'Bob'};
 const invalid=[null,{},[],accepted,[accepted,accepted],[{...accepted,accepted:false}],[wrongName],[{...accepted,extra:1}],[{...accepted,result_best_score:99}],[{...accepted,is_first_play:false}],[{...accepted,result_play_count:0}],[{...accepted,result_first_score:null}]];
 for(const response of invalid){await deliver(response);assert.equal(run('lastResult.deliveryKey'),'sendFailed',JSON.stringify(response));assert.deepEqual(value('paints'),[]);await run('submitScoreAndLoadRanking(lastResult)');assert.equal(run('calls.length'),1);assert.equal(run('reads'),1);}
});
test('valid normal8 receipt uses captured name and score and exact existing submit args',async()=>{
 run('fresh()');const pending=run('submitScoreAndLoadRanking(lastResult)');
 assert.deepEqual(value('calls'),[['submit_score',{p_display_name:'Alice',p_game_slug:'yume_wo_mitandakedosa',p_score:100,p_client_version:'yume-mitandakedosa-ranking-v1'}]]);
 context.reply={data:[accepted],error:null};run("lastResult.score=999;lastResult.participation={name:'Bob',participates:true};resolveSubmit(reply)");await pending;
 assert.equal(run('lastResult.deliveryKey'),'sent');assert.deepEqual(value('lastResult.summary'),[100,100,1]);assert.deepEqual(value('paints'),[[100,100,100,1]]);assert.equal(run('reads'),1);
});
test('an old completion cannot paint or read for a newer result',async()=>{
 for(const reply of [{data:[accepted],error:null},{data:null,error:{message:'offline'}}]){run('fresh()');const pending=run('submitScoreAndLoadRanking(lastResult)');context.reply=reply;run("lastResult={resultType:'clear',score:300};paints=[];resolveSubmit(reply)");await pending;assert.deepEqual(value('paints'),[]);assert.equal(run('reads'),0);assert.equal(run('lastResult.score'),300);}
});
test('later-play historical scores and valid zero/negative scores remain accepted',async()=>{
 await deliver([{...accepted,result_first_score:-2147483648,result_best_score:200,result_play_count:2,is_first_play:false,is_new_best:false}]);assert.equal(run('lastResult.deliveryKey'),'sent');
 for(const score of [0,-100]){run('fresh()');context.score=score;run('lastResult.score=score');const pending=run('submitScoreAndLoadRanking(lastResult)');context.reply={data:[{...accepted,result_first_score:score,result_best_score:score}],error:null};run('resolveSubmit(reply)');await pending;assert.equal(run('lastResult.deliveryKey'),'sent');}
});
(async()=>{let failures=0;for(const [name,fn] of cases){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.message);}}process.exitCode=failures?1:0;})();
