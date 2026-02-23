import cron from 'node-cron';
import { getStore, saveStore, addRunLog } from './store';
import { runPythonScript } from './scriptRunner';

// Keep track of active cron tasks in memory
const activeCronJobs = new Map();

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
        const result = await runPythonScript(null); // Cron always runs for today

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

    // Clear all existing
    for (const [id, task] of activeCronJobs.entries()) {
        task.stop();
    }
    activeCronJobs.clear();

    // Schedule active ones
    store.cronJobs.forEach(job => {
        if (job.isActive) {
            try {
                scheduleJob(job.id, job.expression);
            } catch (err) {
                console.error(`Failed to schedule job ${job.id}: ${err.message}`);
            }
        }
    });

    console.log(`Synced ${activeCronJobs.size} cron jobs from store.`);
}
