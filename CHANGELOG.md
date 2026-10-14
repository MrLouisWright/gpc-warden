# Changelog

## 1.0.0 (2026-10-14)

First release, by Louis Wright.

- Detects GPC handling (`navigator.globalPrivacyControl`, `Sec-GPC`) in inline scripts, site JS and edge functions.
- Sale/share trackers that load unconditionally; CMP support with explicit confirmation.
- `/.well-known/gpc.json` presence and validity; privacy policy disclosure; DNT-only handling.
- Text/JSON/SARIF/Markdown output, `--fail-on`, exit codes 0/1/2, allowlist with expiry, severity overrides.
- Composite GitHub Action with job summary.
