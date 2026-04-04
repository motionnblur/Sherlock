#!/usr/bin/env node

import { performance } from 'node:perf_hooks';

const DEFAULT_BACKEND_URL = 'http://localhost:8080';
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'sherlock';
const DEFAULT_FLEET_SIZE = 5000;
const DEFAULT_BULK_BUDGET_MS = 1500;
const DEFAULT_HISTORY_BUDGET_MS = 500;
const MIN_DRONE_ID_WIDTH = 2;

const backendUrl = process.env.BACKEND_URL ?? DEFAULT_BACKEND_URL;
const username = process.env.PERF_USER ?? DEFAULT_USERNAME;
const password = process.env.PERF_PASSWORD ?? DEFAULT_PASSWORD;
const fleetSize = Number(process.env.PERF_FLEET_SIZE ?? DEFAULT_FLEET_SIZE);
const bulkBudgetMs = Number(process.env.PERF_BULK_BUDGET_MS ?? DEFAULT_BULK_BUDGET_MS);
const historyBudgetMs = Number(process.env.PERF_HISTORY_BUDGET_MS ?? DEFAULT_HISTORY_BUDGET_MS);

function buildDroneIds(totalCount) {
  const idWidth = Math.max(MIN_DRONE_ID_WIDTH, String(totalCount).length);
  return Array.from({ length: totalCount }, (_, index) => (
    `SHERLOCK-${String(index + 1).padStart(idWidth, '0')}`
  ));
}

async function login() {
  const response = await fetch(`${backendUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.token) {
    throw new Error('Login response did not include a token');
  }
  return payload.token;
}

async function measureRequest(name, requestFn) {
  const start = performance.now();
  await requestFn();
  const elapsedMs = performance.now() - start;
  console.log(`${name}: ${elapsedMs.toFixed(1)} ms`);
  return elapsedMs;
}

async function main() {
  const droneIds = buildDroneIds(fleetSize);
  const firstDroneId = droneIds[0];
  const token = await login();

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const bulkDuration = await measureRequest('bulk-last-known', async () => {
    const response = await fetch(`${backendUrl}/api/telemetry/last-known`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ droneIds }),
    });

    if (!response.ok) {
      throw new Error(`Bulk last-known failed with HTTP ${response.status}`);
    }
  });

  const historyDuration = await measureRequest('selected-history', async () => {
    const url = new URL(`${backendUrl}/api/telemetry/history`);
    url.searchParams.set('droneId', firstDroneId);

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`History lookup failed with HTTP ${response.status}`);
    }
  });

  const failures = [];
  if (bulkDuration > bulkBudgetMs) {
    failures.push(
      `bulk-last-known ${bulkDuration.toFixed(1)}ms exceeded budget ${bulkBudgetMs}ms`,
    );
  }
  if (historyDuration > historyBudgetMs) {
    failures.push(
      `selected-history ${historyDuration.toFixed(1)}ms exceeded budget ${historyBudgetMs}ms`,
    );
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FAIL: ${failure}`);
    }
    process.exit(1);
  }

  console.log('PASS: performance budgets satisfied');
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
