'use strict';
// Only four selected, side-effect-bounded product functions run with a fake DOM.
// No whole-game IIFE, SDK, network, storage, timers, audio, or browser is invoked.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
function extract(name) {
  const match = html.match(new RegExp('^      (?:async )?function ' + name + '\\([^\\n]*\\) \\{\\n[\\s\\S]*?^      \\}', 'm'));
  assert.ok(match, name);
  return match[0];
}
const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
new vm.Script(['formatRankingScore', 'pickRankingScoreText', 'pickField', 'renderRankingList'].map(extract).join('\n') + `
function node() { return { children: [], textContent: '', classList: { toggle() {} }, appendChild(n) { this.children.push(n); }, set innerHTML(v) { this.children = []; } }; }
const document = { createElement: node }, rankingList = node(), bestRankingTab = node(), firstRankingTab = node();
const SCORE_SCALE = 1, SCORE_DECIMALS = 0, i18n = { getLocale() { return 'en'; } };
function t(key) { return key; }
let lastResult = null;
`).runInContext(context, { timeout: 1000 });
const run = source => new vm.Script(source).runInContext(context, { timeout: 1000 });
const value = source => JSON.parse(run('JSON.stringify(' + source + ')'));
const row = values => ({ rank_no: 1, display_name: 'Alice', first_score: -100, best_score: 1234, play_count: 2, updated_at: '2026-01-01T00:00:00Z', ...values });
function score(entry, type) { context.entry = entry; context.kind = type; return run('pickRankingScoreText(entry, kind)'); }
const cases = [];
function test(name, fn) { cases.push([name, fn]); }
test('best tab uses best_score rather than display/raw/generic aliases', () => {
  assert.equal(score(row({ display_best_score: 'invented', display_score: 'other', raw_best_score: 9999, score: 8888 }), 'best'), '1,234 points');
});
test('first tab uses first_score rather than display/raw/generic aliases', () => {
  assert.equal(score(row({ display_first_score: 'invented', display_score: 'other', raw_first_score: 9999, score: 8888 }), 'first'), '-100 points');
});
test('invalid authoritative values cannot borrow aliases or the other tab score', () => {
  for (const type of ['best', 'first']) {
    for (const invalid of [null, undefined, '100', 0.5, 2147483648]) {
      const entry = row({ [type + '_score']: invalid, display_best_score: 'invented', display_first_score: 'invented', display_score: 'invented', raw_best_score: 500, raw_first_score: 500, score: 500 });
      assert.equal(score(entry, type), '—', type + ': ' + String(invalid));
    }
  }
});
test('non-number, fraction and outside-int4 values stay unknown without coercion', () => {
  for (const type of ['best', 'first']) {
    for (const invalid of [1.5, -1.5, 2147483648, -2147483649, Number.MAX_SAFE_INTEGER, '0', '-100', '', ' ', true, false, [], {}, null, undefined, NaN, Infinity, -Infinity]) {
      assert.equal(score(row({ [type + '_score']: invalid }), type), '—', type + ': ' + String(invalid));
    }
  }
});
test('zero, negative and signed-int4 boundaries keep the existing units and format', () => {
  for (const type of ['best', 'first']) {
    for (const [number, expected] of [[0, '0 points'], [-100, '-100 points'], [1234, '1,234 points'], [-2147483648, '-2,147,483,648 points'], [2147483647, '2,147,483,647 points']]) {
      assert.equal(score(row({ [type + '_score']: number }), type), expected);
    }
  }
});
test('missing row or selected field is unknown, not a substituted score', () => {
  for (const type of ['best', 'first']) {
    for (const entry of [null, undefined, 0, false, '', [], {}, { best_score: type === 'best' ? undefined : 100, first_score: type === 'first' ? undefined : 100 }]) {
      assert.equal(score(entry, type), '—');
    }
  }
});
test('real list caller preserves returned order, ties, unknown ranks and 30-row cap', () => {
  context.rows = [row({ rank_no: 1, display_name: '<Alice>', first_score: 0, best_score: 100 }), row({ rank_no: 1, display_name: 'Bob', first_score: -100, best_score: 100 }), row({ rank_no: 3, display_name: 'Carol', first_score: null, best_score: 1.5 }), row({ rank_no: '4', display_name: 'Dave', first_score: 10, best_score: 50 }), ...Array.from({ length: 27 }, (_, i) => row({ rank_no: i + 5, display_name: 'P' + i, first_score: i, best_score: i }))];
  run("lastResult = { rankingState: 'ready', bestRanking: rows, firstRanking: rows }; renderRankingList('best');");
  assert.equal(run('rankingList.children.length'), 30);
  assert.deepEqual(value('rankingList.children.slice(0, 4).map(n => n.children.map(c => c.textContent))'), [['#1', '<Alice>', '100 points'], ['#1', 'Bob', '100 points'], ['#3', 'Carol', '—'], ['—', 'Dave', '50 points']]);
  run("renderRankingList('first');");
  assert.equal(run('rankingList.children.length'), 30);
  assert.deepEqual(value('rankingList.children.slice(0, 4).map(n => n.children[2].textContent)'), ['0 points', '-100 points', '—', '10 points']);
});
let failures = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failures++; console.error('FAIL ' + name + ': ' + error.message); }
}
process.exitCode = failures ? 1 : 0;
