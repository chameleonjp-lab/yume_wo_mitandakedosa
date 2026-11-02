'use strict';
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script(readFileSync(join(__dirname,'../share.js'),'utf8')).runInContext(context,{timeout:1000});
const api=context.YumeShare;
const languages=['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th'];
const url='https://chameleonjp.codeberg.page/yume_wo_mitandakedosa/';
// Conservative scalar weights (emoji sequences may be overcounted), fixed t.co URL weight.
function weight(body){const prefix=body.slice(0,-url.length);return 23+Array.from(prefix).reduce((n,c)=>{const p=c.codePointAt(0);return n+((p<=0x10ff||(p>=0x2000&&p<=0x200d)||(p>=0x2010&&p<=0x201f)||(p>=0x2032&&p<=0x2037))?1:2);},0);}
let clock=1000;
for(const lang of languages){
 assert.ok(api.text(lang)[0].includes('X'));
 for(const result of [null,{resultType:'clear',score:-100000000,playerName:'PRIVATE_TEST'},{resultType:'retire',score:100000000}]){
  const body=api.makeShareText(lang,url,result);
  assert.equal(body.split('#夢を見たんだけどさ').length,2);
  assert.equal(body.split('#ゲーム制作').length,2);
  assert.ok(body.endsWith(url));assert.ok(!body.includes('PRIVATE_TEST'));
  assert.ok(weight(body)<=280,lang+': '+weight(body));
  assert.ok(!body.includes('\\n'));
  let intent,calls=0;
  const link={click(){intent=this.href;}};
  const popup={opener:{},document:{createElement(){return link;},body:{appendChild(){}}}};
  const resultOpen=api.openShare(lang,url,result,(value,target)=>{calls++;assert.equal(value,'about:blank');assert.equal(target,'_blank');return popup;},()=>{throw Error('unexpected fallback');},()=>clock);
  assert.equal(resultOpen.status,'opened');assert.equal(popup.opener,null);
  assert.equal(link.target,'_self');assert.equal(link.rel,'noreferrer');assert.equal(link.referrerPolicy,'no-referrer');
  assert.equal(decodeURIComponent(intent.split('?text=')[1]),body);
  assert.equal(api.openShare(lang,url,result,()=>{calls++;},()=>{},()=>clock+499).status,'suppressed');assert.equal(calls,1);
  clock+=1000;
  let copied;api.openShare(lang,url,result,()=>null,value=>{copied=value;},()=>clock);assert.equal(copied,body);clock+=1000;
 }
}
assert.equal(api.text('ja')[0],'Xでシェア');
assert.throws(()=>api.makeShareText('ja',url,{score:NaN,resultType:'clear'}));
console.log('PASS: 15 locales × home/clear/retire, exact 2 tags, signed score, conservative 280, intent, fallback');

let closed=0,copied=0;
const unsafe={get opener(){return {};},set opener(value){},close(){closed++;}};
assert.equal(api.openShare('ja',url,null,()=>unsafe,()=>{copied++;},()=>clock).status,'fallback');
assert.equal(closed,1);assert.equal(copied,1);clock+=1000;
const navigationFailure={opener:{},document:{createElement(){throw Error('DOM unavailable');}},close(){closed++;}};
assert.equal(api.openShare('ja',url,null,()=>navigationFailure,()=>{copied++;},()=>clock).status,'fallback');
assert.equal(closed,2);assert.equal(copied,2);
console.log('PASS: opener isolation, referrer boundary, one popup, cooldown and failure-only fallback');
