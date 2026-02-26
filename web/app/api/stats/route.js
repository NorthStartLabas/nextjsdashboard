import { NextResponse } from 'next/server';
import { getStore, resetStats } from '@/lib/store';
import { getIsRunning } from '@/lib/scriptRunner';
import { ensureCronInitialized } from '@/lib/cronManager';

export async function GET() {
    ensureCronInitialized();
    const store = getStore();

    const totalRuns = store.totalRunsCount || store.runs.length;
    const successfulRuns = store.totalSuccessfulRuns || store.runs.filter(r => r.success).length;
    const totalDurationMs = store.totalDurationMs || store.runs.reduce((acc, r) => acc + (r.durationMs || 0), 0);
    const failedRuns = totalRuns - successfulRuns;

    const successRate = totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(1) : 0;
    const avgDurationMs = totalRuns > 0 ? totalDurationMs / totalRuns : 0;

    let uptimeString = 'Unknown';
    if (store.uptimeStart) {
        const diff = Date.now() - new Date(store.uptimeStart).getTime();
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        uptimeString = `${hours}h ${mins}m`;
    }

    const memoryUptime = process.uptime();
    const mHours = Math.floor(memoryUptime / 3600);
    const mMins = Math.floor((memoryUptime % 3600) / 60);

    return NextResponse.json({
        uptime: `${mHours}h ${mMins}m`,
        totalRuns,
        successfulRuns,
        failedRuns,
        successRate: `${successRate}%`,
        avgDurationSec: (avgDurationMs / 1000).toFixed(1),
        lastRun: store.runs.length > 0 ? store.runs[0] : null,
        runs: store.runs,
        isRunning: getIsRunning()
    });
}

export async function POST() {
    resetStats();
    return NextResponse.json({ success: true });
}


