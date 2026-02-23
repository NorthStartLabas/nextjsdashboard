import { NextResponse } from 'next/server';
import { getStore, saveStore } from '@/lib/store';

export async function GET() {
    const store = getStore();
    return NextResponse.json(store.thresholds || {});
}

export async function PUT(request) {
    try {
        const body = await request.json();
        const store = getStore();

        // Body will be { typeFlowId: { emerald: 100, blue: 60, orange: 40, red: 0 } }
        // Merge the new thresholds with existing ones
        store.thresholds = {
            ...store.thresholds,
            ...body
        };
        saveStore(store);

        return NextResponse.json({ success: true, thresholds: store.thresholds });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
}
