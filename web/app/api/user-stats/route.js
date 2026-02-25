import { NextResponse } from 'next/server';
import { runUserStatsScript } from '@/lib/scriptRunner';

export async function POST(request) {
    try {
        const body = await request.json();
        const { qname, lgnum, activity } = body;

        if (!qname || !lgnum) {
            return NextResponse.json(
                { success: false, error: 'Missing qname or lgnum' },
                { status: 400 }
            );
        }

        const result = await runUserStatsScript(qname, lgnum, activity || 'picking');
        return NextResponse.json(result);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
