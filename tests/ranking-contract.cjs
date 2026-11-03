'use strict';
// Read-only: real formatter, renderer and read caller; local fake DOM/RPC only.
const {readFileSync}=require('node:fs');const {join}=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
function extract(name){const m=html.match(new RegExp('^      (?:async )?function '+name+'\\([^\\n]*\\) \\{\\n[\\s\\S]*?^      \\}','m'));assert.ok(m,name);return m[0];}
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script(['formatRankingScore','pickRankingScoreText','pickField','renderRankingList','loadRankingLists'].map(extract).join('\n')+`
function node(){return {children:[],textContent:'',classList:{toggle(){}},appendChild(n){this.children.push(n)},set innerHTML(v){this.children=[]}};}
const document={createElement:node},rankingList=node(),bestRankingTab=node(),firstRankingTab=node();
const SCORE_SCALE=1,SCORE_DECIMALS=0,GAME_SLUG='yume_wo_mitandakedosa',i18n={getLocale(){return 'en';}};function t(k){return k;}
let lastResult=null,rankingReadVersion=1,calls=[];
`).runInContext(context,{timeout:1000});
const run=s=>new vm.Script(s).runInContext(context,{timeout:1000});
const value=s=>JSON.parse(run('JSON.stringify('+s+')'));
const cases=[];function test(name,fn){cases.push([name,fn]);}
test('unknown scores stay unknown, not Number(null) zero',()=>{for(const invalid of [null,undefined,'',' ',false,true,[],{},'not a score',Infinity,NaN]){context.raw=invalid;assert.equal(run('formatRankingScore(raw)'),'-',String(invalid));for(const type of ['best','first']){context.row={rank_no:1,display_name:'Alice',first_score:invalid,best_score:invalid,play_count:2,updated_at:'2026-01-01T00:00:00Z'};context.kind=type;assert.equal(run('pickRankingScoreText(row,kind)'),'—');}}});
test('real six-field rows preserve server ties and zero/negative scores in both tabs',()=>{
 context.rows=[{rank_no:1,display_name:'<Alice>',first_score:0,best_score:100,play_count:2,updated_at:'2026-01-01T00:00:00Z'},{rank_no:1,display_name:'Bob',first_score:-100,best_score:100,play_count:2,updated_at:'2026-01-01T00:00:00Z'},{rank_no:3,display_name:'Carol',first_score:null,best_score:null,play_count:2,updated_at:'2026-01-01T00:00:00Z'}];
 run("lastResult={rankingState:'ready',bestRanking:rows,firstRanking:rows};renderRankingList('best')");assert.deepEqual(value('rankingList.children.map(n=>n.children.map(c=>c.textContent))'),[['#1','<Alice>','100 points'],['#1','Bob','100 points'],['#3','Carol','—']]);
 run("renderRankingList('first')");assert.deepEqual(value('rankingList.children.map(n=>n.children[2].textContent)'),['0 points','-100 points','—']);
});
test('missing or invalid rank_no stays unknown instead of inventing an ordinal',()=>{
 for(const rank of [undefined,null,'1',0,-1,1.5,Number.MAX_SAFE_INTEGER+1,Infinity]){
  context.row={rank_no:rank,rank:8,ranking:9,display_name:'Alice',first_score:0,best_score:100,play_count:2,updated_at:'2026-01-01T00:00:00Z'};
  run("lastResult={rankingState:'ready',bestRanking:[row]};renderRankingList('best')");assert.equal(run('rankingList.children[0].children[0].textContent'),'—',String(rank));
 }
});
test('both ranking RPCs request 30 rows and renderer caps surplus without re-ranking',async()=>{
 run("calls=[];lastResult={rankingState:'loading'};var target=lastResult;var client={rpc(name,args){calls.push([name,args]);return Promise.resolve({error:null,data:Array.from({length:31},(_,i)=>({rank_no:i<2?1:i+1,display_name:'P'+i,first_score:i,best_score:i,play_count:2,updated_at:'2026-01-01T00:00:00Z'}))});}};");await run('loadRankingLists(client,target,1)');
 assert.deepEqual(value('calls'),[['get_best_score_ranking',{p_game_slug:'yume_wo_mitandakedosa',p_limit:30}],['get_first_try_ranking',{p_game_slug:'yume_wo_mitandakedosa',p_limit:30}]]);assert.equal(run('rankingList.children.length'),30);assert.equal(run('rankingList.children[1].children[0].textContent'),'#1');
});
(async()=>{let failures=0;for(const [name,fn] of cases){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.message);}}process.exitCode=failures?1:0;})();
