import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { check, validateGpcJson, RULES } from '../src/index.js';

const fx = (n) => new URL(`./fixtures/${n}`, import.meta.url).pathname;
const rules = (r) => r.findings.map((f) => f.rule);
const site = (files) => { const d = mkdtempSync(join(tmpdir(), 'gw-')); for (const [p, c] of Object.entries(files)) { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), c); } return d; };
const page = (h, b = '') => `<!doctype html><html><head><title>t</title>${h}</head><body>${b}</body></html>`;
const FB = '<script src="https://connect.facebook.net/x.js"></script>';
const OK = JSON.stringify({ gpc: true, lastUpdate: '2026-10-01' });

test('good fixture is clean', () => { assert.deepEqual(check(fx('good')).findings, []); });
test('bad fixture reports its rules', () => { const r = rules(check(fx('bad'))); for (const k of Object.keys(RULES).filter((k) => !['gpc-wellknown-false', 'gpc-wellknown-missing'].includes(k))) assert.ok(r.includes(k), k); });
test('validateGpcJson', () => {
  assert.equal(validateGpcJson(OK), null); assert.equal(validateGpcJson('{"gpc":false}'), null);
  assert.ok(validateGpcJson('nope')); assert.ok(validateGpcJson('[]')); assert.ok(validateGpcJson('{"gpc":true,"lastUpdate":"Oct 1"}'));
});
test('no sale/share vendors: nothing required', () => { assert.deepEqual(rules(check(site({ 'a.html': page('<script src="https://plausible.io/js/script.js"></script>') }))), []); });
test('missing and false well-known file', () => {
  const gate = page(`<script>if(!navigator.globalPrivacyControl){var s=document.createElement('script');s.src='https://connect.facebook.net/x.js'}</script>`);
  assert.deepEqual(rules(check(site({ 'a.html': gate }))), ['gpc-wellknown-missing']);
  assert.deepEqual(rules(check(site({ 'a.html': gate, '.well-known/gpc.json': '{"gpc": false}' }))), ['gpc-wellknown-false']);
  assert.deepEqual(rules(check(site({ 'a.html': gate, '.well-known/gpc.json': OK }))), []);
});
test('Sec-GPC handling in an edge function counts', () => {
  const d = site({ 'a.html': page('<script type="text/plain" data-category="ads" src="https://connect.facebook.net/x.js"></script>'), 'functions/_middleware.js': "export default (req) => req.headers.get('Sec-GPC') === '1'", '.well-known/gpc.json': OK });
  assert.deepEqual(rules(check(d)), []);
});
test('CMP with GPC support needs explicit confirmation', () => {
  const d = site({ 'a.html': page('<script src="https://cdn.cookielaw.org/otSDKStub.js"></script><script type="text/plain" class="optanon-category-C0004" data-category="C0004" src="https://connect.facebook.net/x.js"></script>'), '.well-known/gpc.json': OK });
  assert.ok(rules(check(d)).includes('gpc-not-detected')); assert.match(check(d).findings[0].message, /CMP/);
  assert.deepEqual(rules(check(d, { cmpHonoursGpc: true })), []);
});
test('allowlist with expiry', () => {
  const d = site({ 'a.html': page(FB), '.well-known/gpc.json': OK });
  const r = check(d, { now: new Date('2026-10-14') }, { allowlist: [{ rule: 'gpc-*', reason: 'GPC rollout in progress', expires: '2026-12-01' }] });
  assert.equal(r.findings.length, 0); assert.equal(r.suppressed.length, 2);
});
test('CLI exit codes and formats', () => {
  const bin = new URL('../bin/gpc-warden.js', import.meta.url).pathname;
  const run = (...x) => spawnSync(process.execPath, [bin, ...x], { encoding: 'utf8' });
  assert.equal(run(fx('good'), '--fail-on', 'info').status, 0);
  assert.equal(run(fx('bad')).status, 1);
  assert.equal(run(fx('bad'), '--fail-on', 'none').status, 0);
  assert.equal(run('/nonexistent-dir-xyz').status, 2);
  const s = JSON.parse(run(fx('bad'), '--format', 'sarif', '--fail-on', 'none').stdout); assert.equal(s.version, '2.1.0');
  assert.match(run(fx('bad'), '--format', 'markdown', '--fail-on', 'none').stdout, /\| Severity \|/);
});
