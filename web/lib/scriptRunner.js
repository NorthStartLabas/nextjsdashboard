import { exec } from 'child_process';
import path from 'path';
import { addRunLog } from './store';

let isRunning = false;

export async function runPythonScript(customDate = null) {
    if (isRunning) {
        return { success: false, message: 'Script is already running.', status: 'blocked' };
    }

    isRunning = true;
    const startTime = Date.now();

    return new Promise((resolve) => {
        const scriptDir = path.join(process.cwd(), '..', 'script');
        // Use python3 on Mac, and check if we should use the venv if it exists
        const pythonCmd = 'python3';
        const command = customDate
            ? `${pythonCmd} process_data.py --date ${customDate}`
            : `${pythonCmd} process_data.py`;

        exec(command, { cwd: scriptDir }, (error, stdout, stderr) => {
            isRunning = false;
            const endTime = Date.now();
            const durationMs = endTime - startTime;

            const runLog = {
                id: crypto.randomUUID(),
                timestamp: new Date(startTime).toISOString(),
                durationMs,
                success: !error,
                output: stdout,
                error: error ? error.message : (stderr || null),
                type: customDate ? 'manual_custom_date' : 'manual_today'
            };

            addRunLog(runLog);

            if (error) {
                resolve({ success: false, message: `Script failed: ${error.message}`, log: runLog });
            } else {
                resolve({ success: true, message: 'Script executed successfully.', log: runLog });
            }
        });
    });
}

export function getIsRunning() {
    return isRunning;
}
