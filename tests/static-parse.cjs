'use strict';
// Compile only: never run the game IIFE or any browser/network API.
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=join(__dirname,'..');
const html=readFileSync(join(root,'index.html'),'utf8');
let inline=0,local=0;
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
 const source=match[1].match(/\bsrc="([^"]+)"/);
 if(source){if(/^https?:/.test(source[1]))continue;assert.match(source[1],/^[a-z0-9-]+\.js$/);new vm.Script(readFileSync(join(root,source[1]),'utf8'),{filename:source[1]});local++;}
 else{new vm.Script(match[2],{filename:'index-inline.js'});inline++;}
}
assert.equal(inline,1);assert.equal(local,6);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'duplicate DOM id');
for(const ref of html.matchAll(/getElementById\("([^"]+)"\)/g))assert.ok(ids.includes(ref[1]),'missing DOM id '+ref[1]);
console.log('PASS: six local scripts and inline script compile; literal DOM references exist, no game execution');
