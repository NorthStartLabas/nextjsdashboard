import cron from 'node-cron';
import { getStore, saveStore, addRunLog } from './store';
import { runPythonScript } from './scriptRunner';

// Use global object to survive HMR/Hot Reloads in development
if (!global._cronManager) {
    global._cronManager = {
        activeJobs: new Map(),
        isInitialized: false
    };
}

const activeCronJobs = global._cronManager.activeJobs;

export function ensureCronInitialized() {
    if (global._cronManager.isInitialized) return;
    console.log("Initializing CRON manager...");
    syncCronJobs();
    global._cronManager.isInitialized = true;
}


export function scheduleJob(id, expression) {
    if (activeCronJobs.has(id)) {
        activeCronJobs.get(id).stop();
        activeCronJobs.delete(id);
    }

    // Validate expression
    if (!cron.validate(expression)) {
        throw new Error(`Invalid cron expression: ${expression}`);
    }

    const task = cron.schedule(expression, async () => {
        console.log(`Running scheduled job: ${id}`);
        // Pass 'cron' as a flag to indicate this is an automated run
        const result = await runPythonScript('cron');

        // Check if store needs to update the lastRun time for this job
        const store = getStore();
        const jobIndex = store.cronJobs.findIndex(j => j.id === id);
        if (jobIndex > -1) {
            store.cronJobs[jobIndex].lastRun = new Date().toISOString();
            saveStore(store);
        }
    }, {
        scheduled: true
    });

    activeCronJobs.set(id, task);
}

export function unscheduleJob(id) {
    if (activeCronJobs.has(id)) {
        activeCronJobs.get(id).stop();
        activeCronJobs.delete(id);
    }
}

export function syncCronJobs() {
    const store = getStore();

    console.log("Syncing CRON jobs. Current active count in memory:", activeCronJobs.size);

    // 1. Clear our tracked Map
    for (const [id, task] of activeCronJobs.entries()) {
        task.stop();
    }
    activeCronJobs.clear();

    // 2. Aggressive cleanup: Stop ANY tasks node-cron might be holding 
    // This handles "ghost" tasks from previous module instances during HMR
    try {
        const allTasks = cron.getTasks();
        console.log(`Aggressive cleanup: Found ${allTasks.length} total tasks in node-cron registry. Stopping all.`);
        allTasks.forEach(task => {
            if (typeof task.stop === 'function') task.stop();
        });
    } catch (e) {
        console.error("Error during aggressive cron cleanup:", e);
    }

    // 3. Schedule active ones from store
    store.cronJobs.forEach(job => {
        if (job.isActive) {
            try {
                scheduleJob(job.id, job.expression);
            } catch (err) {
                console.error(`Failed to schedule job ${job.id}: ${err.message}`);
            }
        }
    });

    console.log(`Sync complete. Now running ${activeCronJobs.size} active jobs.`);
}


