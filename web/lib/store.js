import fs from 'fs';
import path from 'path';

const storePath = path.join(process.cwd(), 'data', 'store.json');

export function getStore() {
    if (!fs.existsSync(storePath)) {
        const initialData = {
            uptimeStart: new Date().toISOString(),
            runs: [],
            totalRunsCount: 0,
            totalSuccessfulRuns: 0,
            totalDurationMs: 0,
            cronJobs: [],
            thresholds: {
                cvns_A: { emerald: 100, blue: 60, orange: 40, red: 0 },
                cvns_B: { emerald: 100, blue: 60, orange: 40, red: 0 },
                ms_A: { emerald: 100, blue: 60, orange: 40, red: 0 },
                ms_B: { emerald: 100, blue: 60, orange: 40, red: 0 }
            },
            userMappings: {},
            blacklist: []
        };
        fs.mkdirSync(path.dirname(storePath), { recursive: true });
        fs.writeFileSync(storePath, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    const data = fs.readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(data);

    // Migration: add thresholds if old store
    if (!parsed.thresholds) {
        parsed.thresholds = {
            cvns_A: { emerald: 100, blue: 60, orange: 40, red: 0 },
            cvns_B: { emerald: 100, blue: 60, orange: 40, red: 0 },
            ms_A: { emerald: 100, blue: 60, orange: 40, red: 0 },
            ms_B: { emerald: 100, blue: 60, orange: 40, red: 0 }
        };
    }

    if (!parsed.userMappings) parsed.userMappings = {};
    if (!parsed.blacklist) parsed.blacklist = [];
    if (!parsed.uptimeStart) parsed.uptimeStart = new Date().toISOString();
    if (parsed.totalRunsCount === undefined || (parsed.runs.length > parsed.totalRunsCount)) {
        parsed.totalRunsCount = Math.max(parsed.totalRunsCount || 0, parsed.runs.length);
    }
    if (parsed.totalSuccessfulRuns === undefined) {
        parsed.totalSuccessfulRuns = parsed.runs.filter(r => r.success).length;
    }
    if (parsed.totalDurationMs === undefined) {
        parsed.totalDurationMs = parsed.runs.reduce((acc, r) => acc + (r.durationMs || 0), 0);
    }

    saveStore(parsed);
    return parsed;
}

export function saveStore(data) {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

export function addRunLog(run) {
    const store = getStore();
    store.runs.unshift(run); // Add to beginning

    // Update cumulative stats
    store.totalRunsCount = (store.totalRunsCount || 0) + 1;
    if (run.success) {
        store.totalSuccessfulRuns = (store.totalSuccessfulRuns || 0) + 1;
    }
    store.totalDurationMs = (store.totalDurationMs || 0) + (run.durationMs || 0);

    // Keep only the last 500 runs to prevent unbounded growth
    if (store.runs.length > 500) store.runs.pop();
    saveStore(store);
}

export function resetStats() {
    const store = getStore();
    store.runs = [];
    store.totalRunsCount = 0;
    store.totalSuccessfulRuns = 0;
    store.totalDurationMs = 0;
    saveStore(store);
}

