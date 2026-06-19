# Legacy Paths

This repository now uses `web-app` as the canonical website root.

## Compatibility aliases
- Legacy root `anatoly-sokoloff-a-visual-journey-32aed43c.base44.app` is kept as a junction when possible.
- If a process lock blocks junction replacement, legacy root is mirrored from `web-app`.
- Renamed file paths are backfilled at their old paths using hard links where possible.
- If hard links fail, a copied compatibility file is used.

## Removal policy
- Keep legacy aliases until all scripts/bookmarks migrate to canonical paths.
- Remove aliases only in a dedicated follow-up cleanup pass.

## Alias cleanup helper
- Script: `web-app/docs/remove-legacy-aliases.ps1`
- Source map: `web-app/docs/rename-map.json`
