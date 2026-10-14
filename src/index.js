// gpc-warden: Global Privacy Control compliance checks for a built site. Louis Wright, MIT.
import { runBeacon, finder, SITE_OPTIONS, SITE_HELP, siteOptions, ancestor } from './site.js';
import { buildReport, UsageError } from './core.js';
import { thirdPartyResources } from './vendors.js';

export * from './core.js';
export { SITE_OPTIONS, SITE_HELP, siteOptions };

export const RULES = {
  'gpc-not-detected': { severity: 'high', title: 'Site uses sale/share (advertising) trackers but no code reads navigator.globalPrivacyControl or Sec-GPC' },
  'gpc-tracker-not-suppressed': { severity: 'high', title: 'Sale/share tracker loads unconditionally, so it cannot be suppressed when GPC is on' },
  'gpc-wellknown-invalid': { severity: 'medium', title: '/.well-known/gpc.json is not valid ({"gpc": true, "lastUpdate": "YYYY-MM-DD"})' },
  'gpc-wellknown-false': { severity: 'medium', title: '/.well-known/gpc.json says gpc: false while sale/share trackers are used' },
  'gpc-wellknown-missing': { severity: 'low', title: 'No /.well-known/gpc.json declaring GPC support' },
  'gpc-policy-missing': { severity: 'low', title: 'Privacy policy does not mention Global Privacy Control / opt-out preference signals' },
  'gpc-dnt-only': { severity: 'info', title: 'Code honours Do Not Track but not Global Privacy Control' },
};
const GPC_RE = /globalPrivacyControl|sec-gpc|Sec-GPC|\bgpc\b\s*[:=]|gpcEnabled|isGpcEnabled|honorGPC|respectGpc/;
const DNT_RE = /navigator\.doNotTrack|\bDNT\b/;
const CMP_GPC_RE = /OneTrust|cookielaw|otSDKStub|Osano|Usercentrics|Didomi|Termly|Ketch|TrustArc|Transcend|cookieyes|iubenda/i;
const POLICY_PATH = /(^|\/)(privacy|privacy[-_]policy|privacy[-_]notice|ccpa|do-not-sell|your-privacy-choices)(\/index)?\.html?$/i;

export function validateGpcJson(text) {
  let j; try { j = JSON.parse(text); } catch (e) { return [`not valid JSON (${e.message})`]; }
  const err = [];
  if (!j || typeof j !== 'object' || Array.isArray(j)) return ['must be a JSON object'];
  if (typeof j.gpc !== 'boolean') err.push('"gpc" must be true or false');
  if (j.lastUpdate != null && (!/^\d{4}-\d{2}-\d{2}$/.test(j.lastUpdate) || Number.isNaN(Date.parse(j.lastUpdate)))) err.push('"lastUpdate" must be YYYY-MM-DD');
  return err.length ? err : null;
}

export function analyze(site, opts = {}, config = {}) {
  const { findings, add } = finder(RULES);
  const siteHost = site.origin ? new URL(site.origin).host : null;
  // code that reads GPC: inline scripts, local .js/.mjs files, edge/serverless functions in the build
  const jsFiles = site.files.filter((f) => /\.(m?js|cjs|ts)$/i.test(f) && !/\.min\.js\.map$/.test(f) && !/(^|\/)(vendor|node_modules)\//.test(f));
  const gpcSources = []; let dntOnly = false; let cmpWithGpc = false;
  for (const f of jsFiles) { const c = site.read(f) || ''; if (GPC_RE.test(c)) gpcSources.push(f); else if (DNT_RE.test(c)) dntOnly = true; }
  const sellers = new Map();
  for (const pg of site.pages) {
    const inline = pg.doc.all.filter((e) => e.tag === 'script' && e.rawText);
    if (inline.some((e) => GPC_RE.test(e.rawText))) gpcSources.push(pg.file); else if (inline.some((e) => DNT_RE.test(e.rawText))) dntOnly = true;
    if (pg.doc.all.some((e) => e.tag === 'script' && (CMP_GPC_RE.test(e.attrs.src || '') || CMP_GPC_RE.test(e.rawText || '')))) cmpWithGpc = true;
    for (const r of thirdPartyResources(pg.doc, siteHost)) {
      if (!r.vendor?.sells) continue;
      if (!sellers.has(r.vendor.id)) sellers.set(r.vendor.id, { v: r.vendor, pages: [] });
      sellers.get(r.vendor.id).pages.push(pg.path);
      const gated = (el) => (el.tag === 'script' && el.attrs.type && /plain|text\/x-|consent/i.test(el.attrs.type)) || Object.keys(el.attrs).some((k) => /^data-(category|cookieconsent|cookiecategory|consent|cmp|src|gpc)/.test(k)) || !!ancestor(el, (n) => n.tag === 'template');
      const condInline = r.inline && GPC_RE.test(r.el.rawText || '');
      if (!gated(r.el) && !condInline && !(r.inline && /consent|hasConsent|Cookiebot|OnetrustActiveGroups/i.test(r.el.rawText || ''))) add('gpc-tracker-not-suppressed', `${pg.path}#${r.vendor.id}`, `${r.vendor.name} (${r.kind}) loads unconditionally on ${pg.path}`, 'Load it from a script that first checks navigator.globalPrivacyControl (and consent), or tag it for your CMP so it is suppressed when GPC is on.', { file: pg.file, line: r.line });
    }
  }
  const usesSale = sellers.size > 0;
  const honoured = gpcSources.length > 0 || (cmpWithGpc && (opts.cmpHonoursGpc ?? config.cmpHonoursGpc ?? false));
  if (usesSale && !honoured) add('gpc-not-detected', 'gpc', `Sale/share vendors (${[...sellers.values()].map((s) => s.v.name).join(', ')}) are used but no code checks navigator.globalPrivacyControl or Sec-GPC${cmpWithGpc ? ' (a CMP with GPC support is present: confirm GPC is enabled and pass --cmp-honours-gpc)' : ''}`, 'Read navigator.globalPrivacyControl (and the Sec-GPC request header server-side) and treat it as an opt-out of sale/sharing (CCPA/CPRA, Colorado, Connecticut).', {});
  if (usesSale && !honoured && dntOnly) add('gpc-dnt-only', 'dnt', 'Code honours Do Not Track but not Global Privacy Control', 'Also check navigator.globalPrivacyControl; DNT is not a legally recognised opt-out.', {});
  const wk = site.read('.well-known/gpc.json');
  if (wk == null) { if (usesSale || honoured) add('gpc-wellknown-missing', '.well-known/gpc.json', 'No /.well-known/gpc.json', 'Publish {"gpc": true, "lastUpdate": "YYYY-MM-DD"} at /.well-known/gpc.json.', { file: '.well-known/gpc.json' }); }
  else { const e = validateGpcJson(wk); if (e) add('gpc-wellknown-invalid', '.well-known/gpc.json', `/.well-known/gpc.json: ${e.join('; ')}`, 'Use {"gpc": true, "lastUpdate": "YYYY-MM-DD"}.', { file: '.well-known/gpc.json' }); else if (JSON.parse(wk).gpc === false && usesSale) add('gpc-wellknown-false', '.well-known/gpc.json', '/.well-known/gpc.json declares gpc: false while sale/share trackers are used', 'Honour GPC and set "gpc": true.', { file: '.well-known/gpc.json' }); }
  const pol = site.pages.filter((p) => POLICY_PATH.test(p.file));
  if (usesSale && pol.length && !pol.some((p) => /global privacy control|\bGPC\b|opt-out preference signal/i.test(p.doc.text))) add('gpc-policy-missing', 'policy', `Privacy policy (${pol[0].file}) does not mention Global Privacy Control`, 'State that you honour GPC / opt-out preference signals as a request to opt out of sale and sharing.', { file: pol[0].file });
  return { findings, info: { saleShareVendors: [...sellers.keys()], gpcCode: [...new Set(gpcSources)] }, summary: `${site.pages.length} page(s); ${sellers.size} sale/share vendor(s); GPC handling ${honoured ? `found in ${[...new Set(gpcSources)].slice(0, 3).join(', ') || 'CMP'}` : 'not found'}` };
}

export function check(dir, opts = {}, config = {}, configFile) {
  const tool = { name: 'gpc-warden', version: opts.toolVersion || '1.0.0', rules: RULES, emoji: '🛑', defaultFile: 'index.html' };
  return runBeacon(tool, dir, { ...opts, UsageError }, config, configFile, analyze, buildReport);
}
