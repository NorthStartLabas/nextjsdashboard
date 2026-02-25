import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { getStore, saveStore } from '@/lib/store';

export async function GET() {
    const store = getStore();
    const scriptDir = path.join(process.cwd(), '..', 'script', 'output');
    const usersSet = new Set();

    // Read unique users from both files
    // Read unique users from picking and packing daily files
    ['ms', 'cvns'].forEach(type => {
        ['picking', 'packing'].forEach(activity => {
            const file = path.join(scriptDir, `${type}_${activity}_daily_stats.csv`);
            if (fs.existsSync(file)) {
                const csv = fs.readFileSync(file, 'utf8');
                const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
                parsed.data.forEach(row => {
                    if (row.QNAME) usersSet.add(row.QNAME);
                });
            }
        });
    });

    return NextResponse.json({
        userMappings: store.userMappings || {},
        blacklist: store.blacklist || [],
        availableUsers: Array.from(usersSet).sort()
    });
}

export async function POST(request) {
    try {
        const { userMappings, blacklist } = await request.json();
        const store = getStore();

        if (userMappings) store.userMappings = userMappings;
        if (blacklist) store.blacklist = blacklist;

        saveStore(store);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
}
