#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { mainCli, check, RULES, SITE_OPTIONS, SITE_HELP } from '../src/index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
mainCli({
  name: 'gpc-warden', version: pkg.version, configKey: 'gpcWarden', rules: RULES,
  tagline: 'check your built site honours Global Privacy Control',
  usage: 'Usage: gpc-warden [site-dir] [options]',
  help: `${SITE_HELP}GPC
      --cmp-honours-gpc        Your CMP (OneTrust, Osano, Usercentrics, ...) is configured to honour GPC
`,
  options: { ...SITE_OPTIONS, 'cmp-honours-gpc': { type: 'boolean' } },
  run: async ({ dir, values: o, config, configFile }) => check(dir, { cli: o, cmpHonoursGpc: o['cmp-honours-gpc'] || undefined, toolVersion: pkg.version }, config, configFile),
});
