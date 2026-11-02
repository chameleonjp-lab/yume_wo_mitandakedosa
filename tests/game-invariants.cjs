'use strict';
// No third-party dependencies. No game page execution, network, subprocess, or filesystem writes.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = join(__dirname, '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(__dirname, 'original-game-functions.json'), 'utf8'));
const extract = (name) => {
  assert.match(name, /^[A-Za-z][A-Za-z0-9]*$/);
  const match = html.match(new RegExp('^      function ' + name + '\\([^\\n]*\\) \\{\\n[\\s\\S]*?^      \\}', 'm'));
  assert.ok(match, `missing original function ${name}`);
  return match[0];
};
function originalMathBody(name) {
  let body=extract(name);
  // Exact, reviewed display-only substitutions; every other byte remains original.
  if(name==='tryTapSatellite')body=body.replace('showEventToast("satelliteBonus");','showToast("🛰️タップ成功：+4秒");');
  if(name==='tryTapRed')body=body.replace('showEventToast("redBroken");','showToast("赤い流星を壊した");');
  if(name==='startCountdown')body=body.replace('showCountdown("start");','showCountdown("START");');
  return body;
}
for (const [name, hash] of Object.entries(manifest.functions)) {
  assert.equal(createHash('sha256').update(originalMathBody(name)).digest('hex'), hash, `unreviewed game-body change: ${name}`);
}
for (const [name, value] of Object.entries({
  BEST_KEY: 'yume_mitandakedosa_best_codeberg_v1',
  RANKING_NAME_KEY: 'yume_mitandakedosa_ranking_name_v1',
  GAME_SLUG: 'yume_wo_mitandakedosa', CLIENT_VERSION: 'yume-mitandakedosa-ranking-v1',
  SCORE_ORDER: 'desc'
})) assert.ok(html.includes(`const ${name} = ${JSON.stringify(value)};`), `preserve ${name}`);
// Execute only hash-verified functions; no IIFE, CDN, ranking client, timers or document.
const selected = ['defaultStats','makeState','addSurvivalScore','clamp','lerp','distance','hitPlayer',
  'updateGame','handleSkyTap','tryTapSatellite','tryTapRed'];
const context = vm.createContext({}, {codeGeneration: {strings:false, wasm:false}});
const setup = `
let state = makeState(); let lastStamp = 1000; let frameId = 0;
let player = {x:10,y:10,r:5}; const RED_TAP_BONUS=34;
let trace=[];
function spawnObjects(dt){trace.push(['spawn',dt]);}
function updateObjects(dt){trace.push(['objects',dt]);}
function updateHud(){trace.push(['hud']);}
function endGame(kind){trace.push(['end',kind]); state.running=false;}
function requestAnimationFrame(fn){trace.push(['raf']);return 1;}
function removeAt(list,index){list.splice(index,1);}
function showToast(text){trace.push(['toast']);}
function showEventToast(key){trace.push(['toast']);}
`;
new vm.Script(selected.map(extract).join('\n')+'\n'+setup).runInContext(context,{timeout:1000});
const run = (code) => new vm.Script(code).runInContext(context,{timeout:1000});
const value = (expression) => JSON.parse(run(`JSON.stringify(${expression})`));
assert.equal(run('state.timeLeft'),60);
run('state.elapsed=2.9;addSurvivalScore();addSurvivalScore();');
assert.deepEqual(value('[state.score,state.survivalScore,state.survivalSeconds]'),[200,200,2]);
run('state=makeState();state.running=true;trace=[];lastStamp=1000;updateGame(2000);');
assert.equal(run('state.elapsed'),0.05); assert.equal(run('state.timeLeft'),59.95);
assert.deepEqual(value('trace.map(x=>x[0])'),['spawn','objects','hud','raf']);
run('state.timeLeft=0.01;trace=[];updateGame(2050);');
assert.deepEqual(value('trace.map(x=>x[0])'),['spawn','objects','hud','end']);
assert.equal(run('trace.at(-1)[1]'),'clear');
run('state=makeState();state.satellites=[{visible:true,x:10,y:10,r:1}];state.red=[{x:10,y:10,r:1}];handleSkyTap({x:10,y:10});');
assert.deepEqual(value('[state.timeLeft,state.stats.satelliteTapped,state.stats.redDestroyed,state.red.length]'),[64,1,0,1]);
run('handleSkyTap({x:10,y:10});');
assert.deepEqual(value('[state.score,state.stats.redDestroyed,state.red.length]'),[0,1,0]);
assert.equal(run('hitPlayer({x:16,y:10,r:1})'),true);
assert.equal(run('hitPlayer({x:16.01,y:10,r:1})'),false);
assert.equal(run('clamp(-10,24,336)'),24); assert.equal(run('lerp(0,10,0.25)'),2.5);
console.log('PASS: original game-body hashes, identifiers, timer cap, survival score, clear, satellite priority, red score, hit boundary');
