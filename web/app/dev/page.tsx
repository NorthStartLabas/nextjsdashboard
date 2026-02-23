"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Play, Calendar as CalendarIcon, Clock, CheckCircle, XCircle, Activity, Plus, Trash2, Power, Settings2, Save } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function DevDashboard() {
    const [authenticated, setAuthenticated] = useState(false);
    const [password, setPassword] = useState("");

    const [stats, setStats] = useState<any>(null);
    const [cronJobs, setCronJobs] = useState<any[]>([]);
    const [thresholds, setThresholds] = useState<any>({});

    const [dateParam, setDateParam] = useState<Date>();
    const [isExecuting, setIsExecuting] = useState(false);

    // New Cron Form State
    const [newCronName, setNewCronName] = useState("");
    const [newCronExpression, setNewCronExpression] = useState("* * * * *");
    const [cronDialogOpen, setCronDialogOpen] = useState(false);

    const fetchStats = async () => {
        try {
            const res = await fetch("/api/stats");
            if (res.ok) setStats(await res.json());
        } catch (e) { }
    };

    const fetchCron = async () => {
        try {
            const res = await fetch("/api/cron");
            if (res.ok) setCronJobs(await res.json());
        } catch (e) { }
    };

    const fetchThresholds = async () => {
        try {
            const res = await fetch("/api/thresholds");
            if (res.ok) setThresholds(await res.json());
        } catch (e) { }
    };

    useEffect(() => {
        if (authenticated) {
            fetchStats();
            fetchCron();
            fetchThresholds();
            const interval = setInterval(() => {
                fetchStats();
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [authenticated]);

    const handleAuth = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === "MEDTRONIC2026") {
            setAuthenticated(true);
        } else {
            toast.error("Incorrect password", {
                style: { background: "#18181b", borderColor: "#3f3f46", color: "#f4f4f5" }
            });
        }
    };

    const handleRunScript = async () => {
        if (stats?.isRunning || isExecuting) {
            toast.error("Script is already running");
            return;
        }

        setIsExecuting(true);
        toast.info("Script execution started. Note: Browser may pop up for authentication.", {
            duration: 8000,
            style: { background: "#18181b", borderColor: "#3b82f6", color: "#f4f4f5" }
        });

        try {
            const payload = dateParam ? { date: format(dateParam, "yyyy-MM-dd") } : {};

            const res = await fetch("/api/script/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                toast.success(`Execution successful in ${data.log.durationMs}ms`);
            } else {
                toast.error(`Execution failed: ${data.message || 'Unknown error'}`);
            }
            fetchStats();
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleToggleCron = async (id: string, currentStatus: boolean) => {
        try {
            await fetch("/api/cron", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, isActive: !currentStatus })
            });
            fetchCron();
            toast.success(currentStatus ? "Cron job paused" : "Cron job activated");
        } catch (e) { }
    };

    const handleDeleteCron = async (id: string) => {
        try {
            await fetch(`/api/cron?id=${id}`, { method: "DELETE" });
            fetchCron();
            toast.success("Cron job deleted");
        } catch (e) { }
    };

    const handleCreateCron = async () => {
        try {
            const res = await fetch("/api/cron", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newCronName, expression: newCronExpression })
            });
            if (res.ok) {
                setCronDialogOpen(false);
                setNewCronName("");
                setNewCronExpression("* * * * *");
                fetchCron();
                toast.success("Cron job created successfully");
            } else {
                const data = await res.json();
                toast.error(data.message || "Invalid cron expression");
            }
        } catch (e) { }
    };

    const handleUpdateThresholds = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/thresholds", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(thresholds)
            });
            if (res.ok) {
                toast.success("Performance thresholds updated!", {
                    style: { background: "#18181b", borderColor: "#3f3f46", color: "#10b981" }
                });
            } else {
                toast.error("Failed to update thresholds.");
            }
        } catch (error) {
            toast.error("Network error saving thresholds.");
        }
    };

    const updateSingleThreshold = (keyName: string, level: string, value: number) => {
        setThresholds((prev: any) => ({
            ...prev,
            [keyName]: {
                ...prev[keyName],
                [level]: value
            }
        }));
    };

    if (!authenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-4 text-zinc-100 font-sans selection:bg-white/10 selection:text-white">
                <Card className="w-full max-w-md bg-zinc-900/40 border-zinc-800/60 shadow-none rounded-2xl overflow-hidden">
                    <CardHeader className="space-y-1 border-b border-zinc-800/40 bg-zinc-900/20 pb-6">
                        <CardTitle className="text-2xl font-semibold tracking-tight text-zinc-100">System Authentication</CardTitle>
                        <CardDescription className="text-zinc-400">Enter administrator password to access DEV panel</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={handleAuth} className="space-y-4">
                            <Input
                                type="password"
                                placeholder="Root Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-zinc-900/50 border-zinc-800 focus-visible:ring-zinc-700 h-11 text-zinc-200"
                            />
                            <Button type="submit" className="w-full bg-zinc-100 text-zinc-900 hover:bg-white font-medium h-11">
                                Authenticate
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const configKeys = [
        { id: "cvns_A", label: "CVNS A-Flow" },
        { id: "cvns_B", label: "CVNS B-Flow" },
        { id: "ms_A", label: "MS A-Flow" },
        { id: "ms_B", label: "MS B-Flow" }
    ];

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-8 font-sans selection:bg-white/10 selection:text-white pb-20">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-4 border-b border-zinc-900/50">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                                Dev Operations Center
                            </h1>
                        </div>
                        <p className="text-sm text-zinc-400 font-medium">
                            Manage Snowflake extraction, automated jobs, and dashboard parameters
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-zinc-900/30 px-3 py-2 rounded-xl border border-zinc-800/50">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            stats?.isRunning || isExecuting ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                        )} />
                        <span className="text-sm font-semibold text-zinc-300">
                            {stats?.isRunning || isExecuting ? 'Script Executing...' : 'System Idle'}
                        </span>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200">
                            <CardTitle className="text-sm font-medium">Server Uptime</CardTitle>
                            <Activity className="h-4 w-4 text-zinc-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-semibold">{stats?.uptime || '--'}</div>
                            <p className="text-xs text-zinc-500 font-medium mt-1">Since last restart</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200">
                            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
                            <Play className="h-4 w-4 text-zinc-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-semibold">{stats?.totalRuns || 0}</div>
                            <p className="text-xs text-zinc-500 font-medium mt-1">Cumulative executions</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200">
                            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                            <CheckCircle className="h-4 w-4 text-emerald-500/80" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-semibold">{stats?.successRate || '0%'}</div>
                            <p className="text-xs text-zinc-500 font-medium mt-1">{stats?.failedRuns || 0} failed runs recorded</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200">
                            <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
                            <Clock className="h-4 w-4 text-blue-500/80" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-semibold">{stats?.avgDurationSec || '0'}s</div>
                            <p className="text-xs text-zinc-500 font-medium mt-1">Based on historical data</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    <div className="lg:col-span-1 space-y-6">
                        <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden">
                            <CardHeader className="border-b border-zinc-800/40 bg-zinc-900/10">
                                <CardTitle className="text-base text-zinc-200">Manual Execution</CardTitle>
                                <CardDescription className="text-zinc-500">Trigger data processing immediately</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <div className="space-y-2">
                                    <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Target Date (Optional)</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start text-left font-medium border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:text-zinc-200 text-zinc-300 h-10">
                                                <CalendarIcon className="mr-2 h-4 w-4 text-zinc-500" />
                                                {dateParam ? format(dateParam, "PPP") : <span>Default to Today</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-zinc-950 border-zinc-800">
                                            <Calendar
                                                mode="single"
                                                selected={dateParam}
                                                onSelect={setDateParam}
                                                initialFocus
                                                className="bg-zinc-950 text-zinc-200"
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <Button
                                    onClick={handleRunScript}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium flex gap-2 h-10 transition-colors"
                                    disabled={stats?.isRunning || isExecuting}
                                >
                                    {stats?.isRunning || isExecuting ? (
                                        <><Clock className="h-4 w-4 animate-spin" /> Processing...</>
                                    ) : (
                                        <><Play className="h-4 w-4 fill-current" /> Run Script Now</>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800/40 bg-zinc-900/10">
                                <div className="space-y-1">
                                    <CardTitle className="text-base text-zinc-200">Cron Scheduler</CardTitle>
                                    <CardDescription className="text-zinc-500">Automated background jobs</CardDescription>
                                </div>
                                <Dialog open={cronDialogOpen} onOpenChange={setCronDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="icon" variant="outline" className="h-8 w-8 border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 hover:text-zinc-100">
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md bg-[#09090b] border-zinc-800/60 shadow-2xl sm:rounded-2xl">
                                        <DialogHeader>
                                            <DialogTitle className="text-zinc-100">Add New Cron Job</DialogTitle>
                                            <DialogDescription className="text-zinc-400">Use standard crontab syntax.</DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label className="text-zinc-300">Job Name</Label>
                                                <Input
                                                    value={newCronName}
                                                    onChange={e => setNewCronName(e.target.value)}
                                                    placeholder="e.g. Midnight Sync"
                                                    className="bg-zinc-900/50 border-zinc-800 text-zinc-200"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-zinc-300">Cron Expression</Label>
                                                <Input
                                                    value={newCronExpression}
                                                    onChange={e => setNewCronExpression(e.target.value)}
                                                    placeholder="0 0 * * *"
                                                    className="bg-zinc-900/50 border-zinc-800 text-zinc-200"
                                                />
                                                <p className="text-[11px] font-medium text-zinc-500">Minute Hour Day Month DayOfWeek</p>
                                            </div>
                                            <Button onClick={handleCreateCron} className="w-full bg-zinc-100 text-zinc-900 hover:bg-white font-medium">Create Schedule</Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent className="p-0">
                                {cronJobs.length === 0 ? (
                                    <div className="text-center py-6 text-zinc-500 text-sm font-medium">
                                        No automated jobs configured
                                    </div>
                                ) : (
                                    <div className="divide-y divide-zinc-800/40">
                                        {cronJobs.map(job => (
                                            <div key={job.id} className="flex items-center justify-between p-4 hover:bg-zinc-800/20 transition-colors">
                                                <div>
                                                    <div className="font-medium text-sm text-zinc-200">{job.name}</div>
                                                    <div className="text-xs text-zinc-500 font-mono mt-0.5">{job.expression}</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Switch
                                                        checked={job.isActive}
                                                        onCheckedChange={() => handleToggleCron(job.id, job.isActive)}
                                                        className="data-[state=checked]:bg-emerald-500"
                                                    />
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteCron(job.id)} className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-400/10">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-2 space-y-6">

                        {/* Threshold Settings */}
                        <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden">
                            <CardHeader className="border-b border-zinc-800/40 bg-zinc-900/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-base text-zinc-200">Performance Thresholds</CardTitle>
                                    <CardDescription className="text-zinc-500">Configure score boundaries per workflow</CardDescription>
                                </div>
                                <Button onClick={handleUpdateThresholds} size="sm" className="bg-zinc-100 text-zinc-900 hover:bg-white font-medium shrink-0">
                                    <Save className="h-4 w-4 mr-2" /> Save configuration
                                </Button>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <form onSubmit={handleUpdateThresholds} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {configKeys.map((cfg) => {
                                        const tValues = thresholds[cfg.id] || { emerald: 100, blue: 60, orange: 40, red: 0 };
                                        return (
                                            <div key={cfg.id} className="p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/30 space-y-4">
                                                <h3 className="font-semibold text-sm text-zinc-200 mb-2">{cfg.label}</h3>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <Label className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Emerald &ge;</Label>
                                                        <Input
                                                            type="number"
                                                            className="h-8 bg-zinc-950 border-zinc-800 text-sm focus-visible:ring-emerald-500/50"
                                                            value={tValues.emerald}
                                                            onChange={(e) => updateSingleThreshold(cfg.id, 'emerald', Number(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <Label className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Blue &ge;</Label>
                                                        <Input
                                                            type="number"
                                                            className="h-8 bg-zinc-950 border-zinc-800 text-sm focus-visible:ring-blue-500/50"
                                                            value={tValues.blue}
                                                            onChange={(e) => updateSingleThreshold(cfg.id, 'blue', Number(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <Label className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Orange &ge;</Label>
                                                        <Input
                                                            type="number"
                                                            className="h-8 bg-zinc-950 border-zinc-800 text-sm focus-visible:ring-orange-500/50"
                                                            value={tValues.orange}
                                                            onChange={(e) => updateSingleThreshold(cfg.id, 'orange', Number(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5 flex flex-col">
                                                        <Label className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Red &ge;</Label>
                                                        <Input
                                                            type="number"
                                                            className="h-8 bg-zinc-950 border-zinc-800 text-sm focus-visible:ring-red-500/50"
                                                            value={tValues.red}
                                                            onChange={(e) => updateSingleThreshold(cfg.id, 'red', Number(e.target.value))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </form>
                            </CardContent>
                        </Card>

                        {/* Logs */}
                        <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden">
                            <CardHeader className="border-b border-zinc-800/40 bg-zinc-900/10">
                                <CardTitle className="text-base text-zinc-200">Execution Logs</CardTitle>
                                <CardDescription className="text-zinc-500">Recent script runs (Last 5)</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {stats?.runs?.length === 0 ? (
                                    <div className="text-center py-12 text-zinc-500 text-sm font-medium">
                                        No runs recorded yet.
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader className="bg-zinc-900/60 border-b border-zinc-800/40">
                                            <TableRow className="border-none hover:bg-transparent">
                                                <TableHead className="py-3 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Status</TableHead>
                                                <TableHead className="py-3 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Type</TableHead>
                                                <TableHead className="py-3 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Timestamp</TableHead>
                                                <TableHead className="py-3 text-xs font-semibold tracking-wider text-zinc-400 uppercase text-right">Duration</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <AnimatePresence>
                                                {stats?.runs?.slice(0, 5).map((run: any) => (
                                                    <motion.tr
                                                        layout
                                                        key={run.id}
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        className="border-b border-zinc-800/20 hover:bg-zinc-800/30 transition-colors"
                                                    >
                                                        <TableCell className="py-3">
                                                            {run.success ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                    Success
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                                                                    Failed
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-3 text-sm text-zinc-300 capitalize">{run.type.replace('_', ' ')}</TableCell>
                                                        <TableCell className="py-3 text-xs text-zinc-500 font-medium">
                                                            {format(new Date(run.timestamp), "MMM d, HH:mm:ss")}
                                                        </TableCell>
                                                        <TableCell className="py-3 text-sm text-zinc-400 font-mono text-right tabular-nums">
                                                            {(run.durationMs / 1000).toFixed(1)}s
                                                        </TableCell>
                                                    </motion.tr>
                                                ))}
                                            </AnimatePresence>
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                </div>
            </div>
        </div>
    );
}
