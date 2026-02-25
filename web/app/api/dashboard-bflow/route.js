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

    const filename = `dashboard_data_${type}${suffix}.json`;
    const filePath = path.join(scriptDir, filename);

    try {
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ 
                success: false, 
                message: `Data file not found: ${filename}`,
                data: null 
            });
        }

        const rawData = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(rawData);

        return NextResponse.json({
            success: true,
            data: jsonData
        });

    } catch (error) {
        return NextResponse.json({ success: false, message: `Error reading file: ${error.message}` }, { status: 500 });
    }
}
