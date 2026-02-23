import { NextResponse } from 'next/server';
import { getStore, saveStore } from '@/lib/store';
import { scheduleJob, unscheduleJob } from '@/lib/cronManager';
import crypto from 'crypto'; // Native node crypto

export async function GET() {
    const store = getStore();
    return NextResponse.json(store.cronJobs);
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { name, expression, isActive } = body;

        const store = getStore();
        const newJob = {
            id: crypto.randomUUID(),
            name,
            expression,
            isActive: isActive !== false, // default true
            createdAt: new Date().toISOString(),
            lastRun: null
        };

        store.cronJobs.push(newJob);
        saveStore(store);

        if (newJob.isActive) {
            scheduleJob(newJob.id, newJob.expression);
        }

        return NextResponse.json({ success: true, job: newJob });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
}

export async function PUT(request) {
    try {
        const body = await request.json();
        const { id, isActive } = body;

        const store = getStore();
        const jobIndex = store.cronJobs.findIndex(j => j.id === id);
        if (jobIndex === -1) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

        store.cronJobs[jobIndex].isActive = isActive;
        saveStore(store);

        if (isActive) {
            scheduleJob(id, store.cronJobs[jobIndex].expression);
        } else {
            unscheduleJob(id);
        }

        return NextResponse.json({ success: true, job: store.cronJobs[jobIndex] });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ success: false, message: 'Missing ID' }, { status: 400 });

        const store = getStore();
        store.cronJobs = store.cronJobs.filter(j => j.id !== id);
        saveStore(store);

        unscheduleJob(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
}
