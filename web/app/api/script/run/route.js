import { NextResponse } from 'next/server';
import { runPythonScript, getIsRunning } from '@/lib/scriptRunner';

export async function POST(request) {
    if (getIsRunning()) {
        return NextResponse.json(
            { success: false, message: 'Script is currently executing. Wait for it to finish.' },
            { status: 409 }
        );
    }

    try {
        const body = await request.json().catch(() => ({}));
        const date = body.date || null; // YYYY-MM-DD

        // Do not await here if you want it completely async. 
        // But since it might take just a few seconds, let's await so the client gets the result immediately.
        const result = await runPythonScript(date);

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ isRunning: getIsRunning() });
}
