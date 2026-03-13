#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const checks = [
  {
    label: 'admin-autopilot-run',
    file: 'src/app/api/admin/autopilot/run/route.ts',
  },
  {
    label: 'cron-aliexpress-sync',
    file: 'src/app/api/cron/aliexpress-sync/route.ts',
  },
];

const forbidden = [
  "@/lib/aliexpress-importer",
  'importFromAliExpress(',
];

const required = [
  'SmartHarvester',
  '.harvestProducts(',
];

let hasErrors = false;

for (const check of checks) {
  const fullPath = resolve(process.cwd(), check.file);
  const source = readFileSync(fullPath, 'utf8');

  for (const token of forbidden) {
    if (source.includes(token)) {
      hasErrors = true;
      console.error(
        `[verify-autopilot-harvester-path] ERROR ${check.label}: znaleziono niedozwolony token "${token}" w ${check.file}`
      );
    }
  }

  for (const token of required) {
    if (!source.includes(token)) {
      hasErrors = true;
      console.error(
        `[verify-autopilot-harvester-path] ERROR ${check.label}: brak wymaganego tokena "${token}" w ${check.file}`
      );
    }
  }
}

if (hasErrors) {
  console.error('[verify-autopilot-harvester-path] FAIL: autopilot/cron musi używać SmartHarvester.');
  process.exit(1);
}

console.log('[verify-autopilot-harvester-path] OK: autopilot/cron używa SmartHarvester.');
