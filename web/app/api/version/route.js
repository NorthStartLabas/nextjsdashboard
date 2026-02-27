import { NextResponse } from 'next/server';
import { getStore, saveStore } from '@/lib/store';

export async function GET() {
    const store = getStore();
    return NextResponse.json({ version: store.version || "V1.0.0" });
}

export async function PUT(request) {
    try {
        const { version } = await request.json();
        const store = getStore();

        store.version = version;
        saveStore(store);

        return NextResponse.json({ success: true, version: store.version });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
}
