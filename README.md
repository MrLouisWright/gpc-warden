# gpc-warden

[![npm version](https://img.shields.io/npm/v/gpc-warden.svg)](https://www.npmjs.com/package/gpc-warden) [![CI](https://github.com/MrLouisWright/gpc-warden/actions/workflows/ci.yml/badge.svg)](https://github.com/MrLouisWright/gpc-warden/actions/workflows/ci.yml) [![Node](https://img.shields.io/node/v/gpc-warden.svg)](https://nodejs.org) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Check that your built site honours Global Privacy Control: it reads the signal and suppresses sale/share trackers when it is on.

Global Privacy Control (`Sec-GPC: 1` and `navigator.globalPrivacyControl`) is a legally binding opt-out of sale and sharing under the CCPA/CPRA and in Colorado, Connecticut and other US states, and California has fined companies for ignoring it. Honouring it means two things: some code has to read the signal, and advertising tags must load in a way that lets that code stop them. `gpc-warden` checks both in your built site, plus the `/.well-known/gpc.json` declaration and your privacy policy, and reports each gap with a **concrete fix**.

CLI, library and GitHub Action. Node.js 18+, **zero runtime dependencies**. Works on any static build output (Astro, Next.js `output: 'export'`, Eleventy, Hugo, Jekyll, Docusaurus, VitePress, plain HTML) and runs offline: point it at the folder your build writes. By Louis Wright.

## Features

- **Signal handling:** looks for `navigator.globalPrivacyControl` / `Sec-GPC` in inline scripts, the site’s own JS files and edge/serverless functions in the build (`functions/`, middleware). Do Not Track-only handling is called out.
- **Suppression:** advertising vendors that sell or share data (Meta, Google Ads, TikTok, LinkedIn, X, Pinterest, Snap, Microsoft, Criteo, Taboola, AddThis, ...) must not load unconditionally: they need a GPC-aware loader or CMP tagging (`type="text/plain"` + category).
- **CMPs:** OneTrust, Osano, Usercentrics, Didomi, Termly, Ketch, TrustArc, Transcend can honour GPC; confirm it is enabled with `--cmp-honours-gpc`.
- **/.well-known/gpc.json:** present, valid (`{"gpc": true, "lastUpdate": "YYYY-MM-DD"}`) and not `false` while selling/sharing.
- **Disclosure:** the privacy policy mentions GPC / opt-out preference signals.
- Text/JSON/SARIF/Markdown output, `--fail-on`, exit codes 0/1/2, allowlist with expiry, severity overrides, GitHub Action with job summary.

### Scope

gpc-warden is a static check; it cannot prove runtime suppression. Consent banners are covered by consent-warden and the full vendor inventory by tracker-warden. Not legal advice.

## Rules

| Rule | Default severity | What it means |
|---|---|---|
| `gpc-not-detected` | high | Site uses sale/share (advertising) trackers but no code reads navigator.globalPrivacyControl or Sec-GPC |
| `gpc-tracker-not-suppressed` | high | Sale/share tracker loads unconditionally, so it cannot be suppressed when GPC is on |
| `gpc-wellknown-invalid` | medium | /.well-known/gpc.json is not valid ({"gpc": true, "lastUpdate": "YYYY-MM-DD"}) |
| `gpc-wellknown-false` | medium | /.well-known/gpc.json says gpc: false while sale/share trackers are used |
| `gpc-wellknown-missing` | low | No /.well-known/gpc.json declaring GPC support |
| `gpc-policy-missing` | low | Privacy policy does not mention Global Privacy Control / opt-out preference signals |
| `gpc-dnt-only` | info | Code honours Do Not Track but not Global Privacy Control |
| `allowlist-expired` | medium | An allowlist entry is past its `expires` date |
| `allowlist-unused` | info | An allowlist entry matched nothing |

## Install and run

```bash
npx gpc-warden dist
npx gpc-warden dist --fail-on medium
npx gpc-warden public --cmp-honours-gpc
npx gpc-warden out --format sarif > gpc.sarif
```

Pages are mapped to URLs the way static hosts serve them: `index.html` → `/`, `blog/index.html` → `/blog/`, `about.html` → `/about.html` (or `/about` with `--clean-urls`). Pass `--base-url` with your public URL, or let it be inferred from canonical / `og:url` tags. Meta-refresh redirect stubs and `404.html` are skipped. `X-Robots-Tag` and `Link` headers are read from Netlify/Cloudflare `_headers` and `vercel.json`.

### Sample output

```text
gpc-warden — https://acme.example
2 page(s); 2 sale/share vendor(s); GPC handling not found

HIGH     Sale/share vendors (Meta Pixel, LinkedIn Insight Tag) are used but no code checks navigator.globalPrivacyControl or Sec-GPC [gpc-not-detected]
         ↳ fix: Read navigator.globalPrivacyControl (and the Sec-GPC request header server-side) and treat it as an opt-out of sale/sharing (CCPA/CPRA, Colorado, Connecticut).
HIGH     index.html:1 Meta Pixel (script) loads unconditionally on / [gpc-tracker-not-suppressed]
         ↳ fix: Load it from a script that first checks navigator.globalPrivacyControl (and consent), or tag it for your CMP so it is suppressed when GPC is on.
HIGH     index.html:1 LinkedIn Insight Tag (pixel) loads unconditionally on / [gpc-tracker-not-suppressed]
         ↳ fix: Load it from a script that first checks navigator.globalPrivacyControl (and consent), or tag it for your CMP so it is suppressed when GPC is on.
MEDIUM   .well-known/gpc.json /.well-known/gpc.json: "gpc" must be true or false [gpc-wellknown-invalid]
```

## Options

```text
gpc-warden 1.0.0 — check your built site honours Global Privacy Control

Usage: gpc-warden [site-dir] [options]

Site
      --base-url <url>        Public URL of the site, e.g. https://example.com (default: inferred from canonical/og:url)
      --include <globs>       Only check these pages (file or URL path globs, comma-separated)
      --exclude <globs>       Skip these pages
      --clean-urls            Pages are served without .html (about.html -> /about)
GPC
      --cmp-honours-gpc        Your CMP (OneTrust, Osano, Usercentrics, ...) is configured to honour GPC

Common
  -c, --config <file>     JSON config (default: .gpc-warden.json or "gpcWarden" in package.json)
  -f, --format <fmt>      text (default) | json | sarif | markdown
      --json <file>       Also write a JSON report
      --sarif <file>      Also write SARIF 2.1.0
      --markdown <file>   Also write Markdown (e.g. for a job summary)
      --fail-on <sev>     critical | high | medium | low | info | none (default: high)
      --list-rules        Print rules and default severities
      --no-fixes          Hide fix suggestions in text output
      --no-color          Disable colours
  -v, --version / -h, --help

Exit codes: 0 = passed, 1 = findings at or above --fail-on, 2 = usage, config or read error.
```

## Configuration and allowlist

Options can live in `.gpc-warden.json` (or a `"gpcWarden"` key in `package.json`, or `--config <file>`):

```json
{
  "failOn": "medium",
  "severity": {
    "gpc-not-detected": "low"
  },
  "allowlist": [
    {
      "rule": "gpc-tracker-not-suppressed",
      "subject": "/landing/*",
      "reason": "Landing pages served only outside the US",
      "expires": "2027-03-31"
    }
  ],
  "cmpHonoursGpc": true
}
```

- **`severity`** changes a rule's severity, or turns it `"off"`.
- **`allowlist`** entries suppress matching findings. Each needs a `reason` and matches on any combination of `rule`, `file`, `subject` (globs with `*`) and `match` (a substring of the message). Add `expires` (`YYYY-MM-DD`) so the exception is time-boxed: once it lapses the finding comes back along with an `allowlist-expired` finding (medium). Entries that no longer match anything are reported as `allowlist-unused` (info).

Config can also set `baseUrl`, `include`, `exclude` and `cleanUrls`. The config file is looked up in the site directory first, then in the current directory, so `.gpc-warden.json` can live at your repository root. Other keys: `cmpHonoursGpc` and `firstParty`.

## Output and exit codes

- `--format text` (default), `json`, `sarif` (SARIF 2.1.0 for GitHub code scanning) or `markdown` (for job summaries and PR comments). `--json`, `--sarif` and `--markdown` write extra report files in the same run.
- `--fail-on <severity>` sets the threshold (`critical`, `high`, `medium`, `low`, `info`, `none`; default `high`).
- Exit codes: **0** passed, **1** findings at or above `--fail-on`, **2** usage, config or read error.

## GitHub Action

```yaml
permissions:
  contents: read
  security-events: write   # only needed for the SARIF upload
jobs:
  gpc-warden:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with: { persist-credentials: false }
      - run: npm ci && npm run build   # produce the static site first
      - uses: MrLouisWright/gpc-warden@v1
        with:
          path: dist
          fail-on: high
          sarif: gpc-warden.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with: { sarif_file: gpc-warden.sarif }
```

| Input | Description | Default |
|---|---|---|
| `path` | Built site directory (e.g. dist, public, _site) | `.` |
| `base-url` | Public URL of the site, e.g. https://example.com | |
| `fail-on` | Failure threshold | `high` |
| `config` | Config file path | |
| `sarif` / `json` | Write SARIF / JSON report to this path | |
| `job-summary` | Add the Markdown report to the job summary | `true` |
| `args` | Extra CLI arguments | |

The action runs the bundled CLI with Node 20; it has no dependencies to install. Pin it to a commit SHA if your policy requires it.

## Library

```js
import { check, validateGpcJson } from "gpc-warden";
const report = check("dist");
validateGpcJson(JSON.stringify({ gpc: true, lastUpdate: "2026-10-01" })); // null
```

Types are included.

## Requirements

Node.js 18 or newer. Zero runtime dependencies.

## Support

If this project is useful to you, you can support its development with a donation: [Buy me a coffee](https://donate.stripe.com/aFa00lek3cvX4Ds2Fk9EI0b). It helps keep these tools maintained, documented and free for everyone.

## Licence

MIT © Louis Wright ([Louis Wright](https://github.com/MrLouisWright))
