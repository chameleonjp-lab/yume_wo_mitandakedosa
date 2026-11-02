'use strict';
const {readFileSync}=require('node:fs');const {join}=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
function extract(name){const m=html.match(new RegExp('^      (?:async )?function '+name+'\\([^\\n]*\\) \\{\\n[\\s\\S]*?^      \\}','m'));assert.ok(m,name);return m[0];}
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script(['renderRankingList','renderRankingReadState','loadRankingLists','pickField'].map(extract).join('\n')+`
function node(){return {children:[],textContent:'',classList:{toggle(){}},appendChild(n){this.children.push(n)},set innerHTML(v){this.children=[]}}}
const rankingList=node(),bestRankingTab=node(),firstRankingTab=node(),nodes={rankingReadStatus:node(),rankingRetryButton:node()};
const document={createElement:node,getElementById(id){return nodes[id]}};
function t(key){return key;} function pickRankingScoreText(row){return String(row.score);}
let lastResult=null,rankingReadVersion=1;const GAME_SLUG='yume_wo_mitandakedosa';
`).runInContext(context,{timeout:1000});
const run=s=>new vm.Script(s).runInContext(context,{timeout:1000});
const cases=[];function test(name,fn){cases.push([name,fn]);}
test('cap30 preserves returned order and safe long name text',()=>{for(const count of [0,1,30,31]){run(`lastResult={rankingState:'ready',bestRanking:Array.from({length:${count}},(_,i)=>({display_name:'<tag>'+i,score:i}))};renderRankingList('best')`);assert.equal(run('rankingList.children.length'),count?Math.min(30,count):1);if(count)assert.equal(run('rankingList.children[0].children[1].textContent'),'<tag>0');}});
test('tab/locale renderer never emits empty during loading or failure',()=>{for(const state of ['loading','failed']){context.status=state;run("lastResult={rankingState:status,bestRanking:[],firstRanking:[]};renderRankingReadState(lastResult);renderRankingList('first')");assert.equal(run('rankingList.children.length'),0);assert.equal(run('nodes.rankingReadStatus.textContent'),state==='loading'?'rankingLoading':'rankingFailed');assert.equal(run('nodes.rankingRetryButton.disabled'),state==='loading');}});
test('retry clears old rows instead of presenting stale confirmed list',()=>{run("lastResult={rankingState:'ready',bestRanking:[{display_name:'OLD',score:1}]};renderRankingList('best');lastResult.rankingState='loading';renderRankingReadState(lastResult)");assert.equal(run('rankingList.children.length'),0);});
test('replay and X precede ranking list in result markup',()=>{const result=html.slice(html.indexOf('<section id="resultScreen"'),html.indexOf('</main>'));for(const id of ['shareResultButton','restartButton','finishButton'])assert.ok(result.indexOf('id="'+id+'"')<result.indexOf('id="rankingBox"'),id);});
test('actual load marks ready only after current successful reads; explicit 30-row read arguments',async()=>{
 run("lastResult={rankingState:'loading'};var target=lastResult,calls=[],pending=[];var client={rpc(name,args){calls.push([name,args]);return new Promise(resolve=>pending.push(resolve));}};");
 const loading=run('loadRankingLists(client,target,1)');assert.equal(run('lastResult.rankingState'),'loading');
 assert.deepEqual(JSON.parse(run('JSON.stringify(calls)')),[['get_best_score_ranking',{p_game_slug:'yume_wo_mitandakedosa',p_limit:30}],['get_first_try_ranking',{p_game_slug:'yume_wo_mitandakedosa',p_limit:30}]]);
 run('pending[0]({data:[],error:null});pending[1]({data:[],error:null});');await loading;
 assert.equal(run('lastResult.rankingState'),'ready');assert.equal(run('rankingList.children[0].textContent'),'rankingEmpty');
 run("lastResult={rankingState:'loading'};target=lastResult;pending=[];");const old=run('loadRankingLists(client,target,1)');
 run("rankingReadVersion=2;pending[0]({data:[],error:null});pending[1]({data:[],error:null});");await old;assert.equal(run('lastResult.rankingState'),'loading');
});
(async()=>{let failures=0;for(const [name,fn] of cases){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.message);}}process.exitCode=failures?1:0;})();
