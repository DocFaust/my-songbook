#!/usr/bin/env bash
set -euo pipefail

EXTRA_ARGS=(--nvdApiDelay 6500 --nvdValidForHours 24)

if [ -d dc-data ] && [ -n "$(ls -A dc-data 2>/dev/null)" ]; then
  EXTRA_ARGS+=(--noupdate)
  echo "dc-data cache found, skipping NVD update (--noupdate)"
else
  echo "dc-data empty, attempting NVD update"
fi

owasp-dependency-check \
  --project my-songbook \
  -f ALL \
  -s . \
  --out ./dependency-check-report \
  --disableAssembly \
  --disableYarnAudit \
  --data ./dc-data \
  --nvdApiKey "${NVDAPIKEY:-}" \
  "${EXTRA_ARGS[@]}"
