import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'ms' or 'cvns'
    const scenario = searchParams.get('scenario') || 'today'; // 'today', 'backlog', 'future'

    if (!type || !['ms', 'cvns'].includes(type)) {
        return NextResponse.json({ success: false, message: 'Invalid or missing type parameter' }, { status: 400 });
    }

    if (!['today', 'backlog', 'future'].includes(scenario)) {
        return NextResponse.json({ success: false, message: 'Invalid scenario parameter' }, { status: 400 });
    }

    const scriptDir = path.join(process.cwd(), '..', 'script', 'output');

    let suffix = '';
    if (scenario === 'backlog') suffix = '_backlog';
    if (scenario === 'future') suffix = '_future';

    const filename = `dashboard_lines_${type}${suffix}.json`;
    const filePath = path.join(scriptDir, filename);

    try {
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({
                success: false,
                message: `Detailed lines file not found: ${filename}`,
                data: []
            });
        }

        const rawData = fs.readFileSync(filePath, 'utf8');
        let jsonData = JSON.parse(rawData);

        // Pre-format WAUHR to HH:MM:SS
        jsonData = jsonData.map(item => {
            let wauhr = item.WAUHR;
            if (wauhr) {
                // If it's a timestamp (number or string-number)
                if (!isNaN(wauhr) && String(wauhr).length > 10) {
                    const date = new Date(Number(wauhr));
                    wauhr = date.toTimeString().split(' ')[0];
                }
                // If it's a full date string "YYYY-MM-DD HH:MM:SS"
                else if (typeof wauhr === 'string' && wauhr.includes(' ')) {
                    wauhr = wauhr.split(' ')[1];
                }
            }
            return { ...item, WAUHR: wauhr || "" };
        });

        // Sort by priority then cutoff
        jsonData.sort((a, b) => {
            const pA = parseInt(a.LPRIO) || 99;
            const pB = parseInt(b.LPRIO) || 99;
            if (pA !== pB) return pA - pB;

            const wA = a.WAUHR === null || a.WAUHR === undefined ? "" : a.WAUHR;
            const wB = b.WAUHR === null || b.WAUHR === undefined ? "" : b.WAUHR;

            if (typeof wA === 'number' && typeof wB === 'number') {
                return wA - wB;
            }
            return String(wA).localeCompare(String(wB));
        });

        return NextResponse.json({
            success: true,
            data: jsonData
        });

    } catch (error) {
        return NextResponse.json({ success: false, message: `Error reading file: ${error.message}` }, { status: 500 });
    }
}
