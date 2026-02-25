import fs from 'fs';
import path from 'path';

const storePath = path.join(process.cwd(), 'data', 'store.json');

export function getStore() {
    if (!fs.existsSync(storePath)) {
        const initialData = {
            uptimeStart: new Date().toISOString(),
            runs: [],
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
    // Keep only the last 100 runs to prevent unbounded growth
    if (store.runs.length > 100) store.runs.pop();
    saveStore(store);
}
