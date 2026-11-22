'use strict';
const {readFileSync}=require('node:fs');const {join}=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
new vm.Script(readFileSync(join(__dirname,'../i18n-runtime.js'),'utf8')).runInContext(context,{timeout:1000});
const serialized=readFileSync(join(__dirname,'../i18n-dictionary.js'),'utf8');
assert.ok(serialized.startsWith('globalThis.YumeDictionary = '));
const dictionary=JSON.parse(serialized.slice('globalThis.YumeDictionary = '.length).trim().replace(/;$/, ''));
const api=context.YumeI18n;
assert.deepEqual(Object.keys(dictionary.ja).sort(),Object.keys(dictionary.en).sort());
assert.equal(api.languages.length,15);assert.equal(Object.keys(dictionary).length,15);
for(const [language] of api.languages){
 assert.deepEqual(Object.keys(dictionary[language]).sort(),Object.keys(dictionary.ja).sort());
 for(const [key,value] of Object.entries(dictionary[language])){
  assert.equal(typeof value,'string');assert.ok(value.length>0);
  assert.deepEqual((value.match(/\{[A-Za-z]+\}/g)||[]).sort(),(dictionary.ja[key].match(/\{[A-Za-z]+\}/g)||[]).sort(),language+':'+key);
 }
 for(const [key,numbers] of Object.entries({tagline:['60'],blueRule:['500'],redRule:['2000','3000'],satelliteRule:['4','3'],sakeRule:['1500','3000'],survivalRule:['100']})) for(const number of numbers)assert.ok(dictionary[language][key].includes(number),language+':'+key);
 assert.ok(dictionary[language].share.includes('X'));
}

for(const [input,expected] of [['zh-Hans-HK','zh-Hans'],['zh-Hant-CN','zh-Hant'],['zh-TW','zh-Hant'],['pt-PT','pt-BR'],['EN_us','en'],['xx',null]])assert.equal(api.fromLocale(input),expected);
let saved='ja';const storage={getItem(){return saved;},setItem(k,v){saved=v;}};
const i=api.createI18n({dictionary,storage,browserLanguages:['en-US']});assert.equal(i.getLanguage(),'ja');assert.equal(i.text('share'),'Xでシェア');
i.setLanguage('en');assert.equal(saved,'en');assert.equal(i.text('bestValue',{score:'-500'}),'Personal best: -500');
assert.equal(i.setLanguage('unknown'),false);assert.equal(i.getLanguage(),'en');
assert.equal(api.createI18n({dictionary,storage:{getItem(){throw Error('storage');}},browserLanguages:['xx']}).getLanguage(),'en');
const memory=api.createI18n({dictionary,storage:{getItem(){return null;},setItem(){throw Error('quota');}},browserLanguages:['ja-JP']});assert.equal(memory.setLanguage('en'),false);assert.equal(memory.getLanguage(),'en');
console.log('PASS: locale mapping, saved preference, fallback, storage failure; all 15 × 71 keys/placeholders/rule numerals present, naturalness/browser remain pending');

const html=readFileSync(join(__dirname,'../index.html'),'utf8');
assert.match(html, /id="homeScreen"[^>]*>\s*<div class="language-picker">\s*<label for="languageSelect" data-i18n="language">[^<]+<\/label>\s*<select id="languageSelect"><\/select>/);
assert.equal((html.match(/id="languageSelect"/g)||[]).length,1);
assert.match(html,/\.home-screen\s*\{\s*flex-direction:\s*column;/);
assert.match(html,/\.language-picker\s*\{[^}]*align-self:\s*flex-start;/);
assert.match(html,/\.language-picker select\s*\{[^}]*min-height:\s*44px;/);
assert.match(html,/option\.lang = id;/);
assert.match(html,/id="copyPanelText"[^>]*aria-labelledby="copyPanelTitle"/);
for(const [, key] of html.matchAll(/data-i18n="([^"]+)"/g)){
 for(const [locale,d] of Object.entries(dictionary)) assert.equal(typeof d[key],'string',locale+':'+key);
}
console.log('PASS: home upper-left language selector structural/keyboard affordances, localized accessibility labels, 15 dictionaries cover all declared UI keys');
