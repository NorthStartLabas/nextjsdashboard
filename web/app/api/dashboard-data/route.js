import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'ms' or 'cvns'

    if (!type || !['ms', 'cvns'].includes(type)) {
        return NextResponse.json({ success: false, message: 'Invalid or missing type parameter' }, { status: 400 });
    }

    const scriptDir = path.join(process.cwd(), '..', 'script', 'output');
    const dailyFile = path.join(scriptDir, `${type}_daily_stats.csv`);
    const hourlyFile = path.join(scriptDir, `${type}_hourly_stats.csv`);

    try {
        const dailyData = [];
        const hourlyData = [];

        if (fs.existsSync(dailyFile)) {
            const dailyCsv = fs.readFileSync(dailyFile, 'utf8');
            Papa.parse(dailyCsv, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                step: (row) => dailyData.push(row.data)
            });
        }

        if (fs.existsSync(hourlyFile)) {
            const hourlyCsv = fs.readFileSync(hourlyFile, 'utf8');
            Papa.parse(hourlyCsv, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                step: (row) => hourlyData.push(row.data)
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                daily: dailyData,
                hourly: hourlyData
            }
        });

    } catch (error) {
        return NextResponse.json({ success: false, message: `Error reading files: ${error.message}` }, { status: 500 });
    }
}
