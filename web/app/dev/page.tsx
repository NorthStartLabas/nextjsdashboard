"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Play, Calendar as CalendarIcon, Clock, CheckCircle, XCircle, Activity, Plus, Trash2, Power, Settings2, Save, Search, Terminal, RotateCcw, Eye, EyeOff, ShieldAlert, Shield, Loader2, ChevronDown, X, History, AlertCircle } from "lucide-react";
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

const SESSION_KEY = "dev_session_expires";
const SESSION_DURATION_MS = 60 * 60 * 1000; // 60 minutes

export default function DevDashboard() {
    const [authenticated, setAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    // 1.7 — restore session from localStorage on mount
    useEffect(() => {
        const expires = localStorage.getItem(SESSION_KEY);
        if (expires && Date.now() < parseInt(expires, 10)) {
            setAuthenticated(true);
        }
    }, []);

    const [stats, setStats] = useState<any>(null);
    const [cronJobs, setCronJobs] = useState<any[]>([]);
    const [thresholds, setThresholds] = useState<any>({});

    const [dateParam, setDateParam] = useState<Date>();
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [version, setVersion] = useState("V1.0.0");

    // User management state
    const [availableUsers, setAvailableUsers] = useState<string[]>([]);
    const [userMappings, setUserMappings] = useState<Record<string, string>>({});
    const [blacklist, setBlacklist] = useState<string[]>([]);
    const [initialUserMappings, setInitialUserMappings] = useState<Record<string, string>>({});
    const [initialBlacklist, setInitialBlacklist] = useState<string[]>([]);
    const [userSearch, setUserSearch] = useState("");

    const hasUserChanges = JSON.stringify(userMappings) !== JSON.stringify(initialUserMappings) ||
        JSON.stringify([...blacklist].sort()) !== JSON.stringify([...initialBlacklist].sort());

    // New Cron Form State
    const [newCronName, setNewCronName] = useState("");
    const [newCronExpression, setNewCronExpression] = useState("* * * * *");
    const [cronDialogOpen, setCronDialogOpen] = useState(false);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);

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

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/users");
            if (res.ok) {
                const data = await res.json();
                setAvailableUsers(data.availableUsers || []);
                setUserMappings(data.userMappings || {});
                setBlacklist(data.blacklist || []);
                setInitialUserMappings(data.userMappings || {});
                setInitialBlacklist(data.blacklist || []);
            }
        } catch (e) { }
    };

    const fetchVersion = async () => {
        try {
            const res = await fetch("/api/version");
            if (res.ok) {
                const data = await res.json();
                setVersion(data.version || "V1.0.0");
            }
        } catch (e) { }
    };

    useEffect(() => {
        if (authenticated) {
            fetchStats();
            fetchCron();
            fetchThresholds();
            fetchUsers();
            fetchVersion();
            const interval = setInterval(() => {
                fetchStats();
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [authenticated]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAuthenticating(true);
        // Simulate a brief async delay for UX feedback
        await new Promise((r) => setTimeout(r, 600));
        if (password === "MEDTRONIC2026") {
            const expires = Date.now() + SESSION_DURATION_MS;
            localStorage.setItem(SESSION_KEY, expires.toString());
            setAuthenticated(true);
        } else {
            toast.error("Incorrect password", {
                style: { background: "#18181b", borderColor: "#3f3f46", color: "#f4f4f5" }
            });
        }
        setIsAuthenticating(false);
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

    const handleResetStats = async () => {
        try {
            const res = await fetch("/api/stats", { method: "POST" });
            if (res.ok) {
                toast.success("Execution statistics have been reset", {
                    style: { background: "#18181b", borderColor: "#3f3f46", color: "#10b981" }
                });
                fetchStats();
            } else {
                toast.error("Failed to reset statistics");
            }
        } catch (e) {
            toast.error("Network error during reset");
        } finally {
            setResetDialogOpen(false);
        }
    };


    const handleSaveUsers = async () => {
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userMappings, blacklist })
            });
            if (res.ok) {
                toast.success("User preferences saved!", {
                    style: { background: "#18181b", borderColor: "#3f3f46", color: "#10b981" }
                });
                setInitialUserMappings(userMappings);
                setInitialBlacklist(blacklist);
            } else {
                toast.error("Failed to save users.");
            }
        } catch (error) {
            toast.error("Network error saving users.");
        }
    };

    const handleSaveVersion = async () => {
        try {
            const res = await fetch("/api/version", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ version })
            });
            if (res.ok) {
                toast.success("System version updated!", {
                    style: { background: "#18181b", borderColor: "#3f3f46", color: "#10b981" }
                });
            } else {
                toast.error("Failed to update version.");
            }
        } catch (error) {
            toast.error("Network error saving version.");
        }
    };

    const toggleBlacklist = (username: string) => {
        setBlacklist(prev =>
            prev.includes(username)
                ? prev.filter(u => u !== username)
                : [...prev, username]
        );
    };

    const updateUserMapping = (username: string, displayName: string) => {
        setUserMappings(prev => ({
            ...prev,
            [username]: displayName
        }));
    };

    const updateSingleThreshold = (cfgId: string, level: string, value: number) => {
        setThresholds((prev: any) => {
            const current = prev[cfgId] || { emerald: 100, blue: 60, orange: 40, red: 0 };
            const next = { ...current, [level]: value };

            // 7.5: Enforce logical ordering: emerald > blue > orange > red
            // When one value is changed, we may need to nudge others to maintain the hierarchy
            if (level === 'emerald') {
                if (next.emerald <= next.blue) next.blue = Math.max(0, next.emerald - 1);
                if (next.blue <= next.orange) next.orange = Math.max(0, next.blue - 1);
                if (next.orange <= next.red) next.red = Math.max(0, next.orange - 1);
            } else if (level === 'blue') {
                if (next.blue >= next.emerald) next.emerald = next.blue + 1;
                if (next.blue <= next.orange) next.orange = Math.max(0, next.blue - 1);
                if (next.orange <= next.red) next.red = Math.max(0, next.orange - 1);
            } else if (level === 'orange') {
                if (next.orange >= next.blue) next.blue = next.orange + 1;
                if (next.blue >= next.emerald) next.emerald = next.blue + 1;
                if (next.orange <= next.red) next.red = Math.max(0, next.orange - 1);
            } else if (level === 'red') {
                if (next.red >= next.orange) next.orange = next.red + 1;
                if (next.orange >= next.blue) next.blue = next.orange + 1;
                if (next.blue >= next.emerald) next.emerald = next.blue + 1;
            }

            return {
                ...prev,
                [cfgId]: next
            };
        });
    };

    if (!authenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-4 text-zinc-100 font-sans selection:bg-white/10 selection:text-white">
                {/* Subtle radial background glow for atmosphere */}
                <div className="absolute inset-0 pointer-events-none" aria-hidden>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-red-950/20 blur-[120px]" />
                </div>

                <Card className="relative w-full max-w-md bg-zinc-900/60 border border-red-900/30 shadow-[0_0_40px_rgba(220,38,38,0.06)] rounded-2xl overflow-hidden backdrop-blur-sm py-0 gap-0">

                    {/* Restricted area banner — 1.4 */}
                    <div className="flex items-center gap-2 px-5 py-2.5 bg-red-950/40 border-b border-red-900/30">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-red-400">Restricted Access</span>
                    </div>

                    <CardHeader className="space-y-2 border-b border-zinc-800/40 bg-zinc-900/10 pt-6 pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
                                <Shield className="w-5 h-5 text-zinc-300" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-semibold tracking-tight text-zinc-100">Developer Panel</CardTitle>
                                <CardDescription className="text-zinc-500 text-xs mt-0.5">Administrator credentials required</CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-6 pb-6">
                        <form onSubmit={handleAuth} className="space-y-4">
                            {/* Password field with show/hide toggle — 1.2 */}
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Root Password"
                                    value={password ?? ""}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    className="bg-zinc-900/50 border-zinc-800 focus-visible:ring-zinc-700 h-11 text-zinc-200 pr-10"
                                    disabled={isAuthenticating}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* 1.5 — intentional button label with icon; 1.3 — loading state */}
                            <Button
                                type="submit"
                                disabled={isAuthenticating || !password}
                                className="w-full bg-zinc-100 text-zinc-900 hover:bg-white font-semibold h-11 flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isAuthenticating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-4 h-4" />
                                        Access Developer Panel
                                    </>
                                )}
                            </Button>


                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const configGroups = [
        {
            title: "CVNS B-Flow Picking",
            keys: [
                { id: "cvns_B_ground_floor", label: "Ground Floor" },
                { id: "cvns_B_first_floor", label: "First Floor" },
                { id: "cvns_B_second_floor", label: "Second Floor" }
            ]
        },
        {
            title: "CVNS B-Flow Packing",
            keys: [
                { id: "cvns_packing_B_ground_floor", label: "Ground Floor" },
                { id: "cvns_packing_B_first_floor", label: "First Floor" },
                { id: "cvns_packing_B_second_floor", label: "Second Floor" }
            ]
        },
        {
            title: "MS Outbound Picking",
            keys: [
                { id: "ms_A", label: "A-Flow" },
                { id: "ms_B", label: "B-Flow" }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-8 font-sans selection:bg-white/10 selection:text-white pb-20">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-4 border-b border-zinc-900/50">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                                <Terminal className="w-6 h-6 text-blue-500" />
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                                Dev Operations Center
                            </h1>
                        </div>
                        <p className="text-sm text-zinc-400 font-medium">
                            Manage Snowflake extraction, automated jobs, and dashboard parameters
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 border-zinc-800 bg-zinc-900/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-zinc-400 gap-2 transition-all">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Reset Stats
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bg-[#09090b] border-zinc-800/60 shadow-2xl sm:rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle className="text-zinc-100">Reset Execution Statistics?</DialogTitle>
                                    <DialogDescription className="text-zinc-400">
                                        This will permanently clear all cumulative run counts, success rates, and execution logs. This action cannot be undone.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex justify-end gap-3 pt-4">
                                    <Button variant="ghost" onClick={() => setResetDialogOpen(false)} className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800">
                                        Cancel
                                    </Button>
                                    <Button onClick={handleResetStats} className="bg-red-600 hover:bg-red-500 text-white font-medium px-6">
                                        Reset Everything
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <div className="flex items-center gap-3 bg-zinc-900/30 px-3 py-2 rounded-xl border border-zinc-800/50">
                            <div className={cn(
                                "w-2 h-2 rounded-full",
                                stats?.isRunning || isExecuting ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                            )} />
                            <span className="text-sm font-semibold text-zinc-300">
                                {stats?.isRunning || isExecuting ? 'Script Executing...' : 'System Idle'}
                            </span>
                        </div>
                    </div>

                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                    {/* Server Uptime — priority card (3.1: emerald left-accent bar) */}
                    <Card className="relative overflow-hidden bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl">
                        <span className="absolute left-0 top-0 h-full w-[3px] bg-emerald-500/60 rounded-r-full" />
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200">
                            <CardTitle className="text-sm font-medium">Server Uptime</CardTitle>
                            <Activity className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            {/* 3.2 — skeleton while loading */}
                            {stats === null ? (
                                <div className="space-y-2 mt-0.5">
                                    <div className="h-7 w-24 bg-zinc-800/80 rounded-lg animate-pulse" />
                                    <div className="h-3 w-28 bg-zinc-800/50 rounded animate-pulse" />
                                </div>
                            ) : (
                                <>
                                    <div className="text-2xl font-semibold">{stats.uptime}</div>
                                    {/* 3.3 — consistent sub-label */}
                                    <p className="text-xs text-zinc-500 font-medium mt-1">Since last restart</p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Total Runs */}
                    <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200">
                            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
                            <Play className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            {stats === null ? (
                                <div className="space-y-2 mt-0.5">
                                    <div className="h-7 w-12 bg-zinc-800/80 rounded-lg animate-pulse" />
                                    <div className="h-3 w-32 bg-zinc-800/50 rounded animate-pulse" />
                                </div>
                            ) : (
                                <>
                                    <div className="text-2xl font-semibold">{stats.totalRuns}</div>
                                    <p className="text-xs text-zinc-500 font-medium mt-1">Cumulative executions</p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Success Rate — priority card (3.1: emerald left-accent bar) */}
                    <Card className="relative overflow-hidden bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl">
                        <span className="absolute left-0 top-0 h-full w-[3px] bg-emerald-500/60 rounded-r-full" />
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200">
                            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                            <CheckCircle className="h-4 w-4 text-emerald-500/80" />
                        </CardHeader>
                        <CardContent>
                            {stats === null ? (
                                <div className="space-y-2 mt-0.5">
                                    <div className="h-7 w-16 bg-zinc-800/80 rounded-lg animate-pulse" />
                                    <div className="h-3 w-28 bg-zinc-800/50 rounded animate-pulse" />
                                </div>
                            ) : (
                                <>
                                    <div className="text-2xl font-semibold">{stats.successRate}</div>
                                    <p className="text-xs text-zinc-500 font-medium mt-1">{stats.failedRuns} failed runs recorded</p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Avg Execution Time */}
                    <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200">
                            <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
                            <Clock className="h-4 w-4 text-blue-500/80" />
                        </CardHeader>
                        <CardContent>
                            {stats === null ? (
                                <div className="space-y-2 mt-0.5">
                                    <div className="h-7 w-14 bg-zinc-800/80 rounded-lg animate-pulse" />
                                    <div className="h-3 w-24 bg-zinc-800/50 rounded animate-pulse" />
                                </div>
                            ) : (
                                <>
                                    {/* 3.4 — show — instead of 0s when no runs exist */}
                                    <div className="text-2xl font-semibold">
                                        {stats.totalRuns === 0 || stats.avgDurationSec == null ? '—' : `${stats.avgDurationSec}s`}
                                    </div>
                                    {/* 3.3 — dynamic sub-label instead of generic "Based on historical data" */}
                                    <p className="text-xs text-zinc-500 font-medium mt-1">
                                        Across {stats.totalRuns} run{stats.totalRuns !== 1 ? 's' : ''}
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>


                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    <div className="lg:col-span-1 space-y-6">
                        <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden">
                            <CardHeader className="border-b border-zinc-800/40 bg-zinc-900/10">
                                <CardTitle className="text-base text-zinc-200">System Configuration</CardTitle>
                                <CardDescription className="text-zinc-500">Manage global system parameters</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <div className="space-y-2">
                                    <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">App Version</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={version}
                                            onChange={(e) => setVersion(e.target.value)}
                                            placeholder="V1.0.0"
                                            className="h-10 bg-zinc-900/50 border-zinc-800 text-zinc-200 focus-visible:ring-zinc-700"
                                        />
                                        <Button
                                            onClick={handleSaveVersion}
                                            size="icon"
                                            className="h-10 w-10 shrink-0 bg-zinc-100 text-zinc-900 hover:bg-white"
                                        >
                                            <Save className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 font-medium">This version string is displayed globally in the sidebar.</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden">
                            <CardHeader className="border-b border-zinc-800/40 bg-zinc-900/10">
                                <CardTitle className="text-base text-zinc-200">Manual Execution</CardTitle>
                                <CardDescription className="text-zinc-500">Trigger data processing immediately</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <div className="space-y-2">
                                    <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Target Date (Optional)</Label>
                                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between font-medium border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:text-zinc-200 text-zinc-300 h-10 px-3 transition-all">
                                                <div className="flex items-center min-w-0">
                                                    <CalendarIcon className="mr-2 h-4 w-4 text-zinc-500 shrink-0" />
                                                    <span className="truncate">
                                                        {dateParam ? format(dateParam, "PPP") : <span className="text-zinc-500">Default to Today</span>}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                                    {dateParam && (
                                                        <div
                                                            role="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setDateParam(undefined);
                                                            }}
                                                            className="p-1 hover:bg-zinc-700/50 rounded-md transition-colors group/clear"
                                                        >
                                                            <X className="h-3.5 w-3.5 text-zinc-500 group-hover/clear:text-zinc-300" />
                                                        </div>
                                                    )}
                                                    <ChevronDown className={cn(
                                                        "h-4 w-4 text-zinc-500 transition-transform duration-200",
                                                        isCalendarOpen && "rotate-180"
                                                    )} />
                                                </div>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-zinc-950 border-zinc-800 shadow-2xl" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={dateParam}
                                                onSelect={(date) => {
                                                    setDateParam(date);
                                                    setIsCalendarOpen(false);
                                                }}
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
                                    <CardTitle className="text-base text-zinc-200">Background Jobs</CardTitle>
                                    <CardDescription className="text-zinc-500">Automated background jobs</CardDescription>
                                </div>
                                <Dialog open={cronDialogOpen} onOpenChange={setCronDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" variant="outline" className="h-8 border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 hover:text-zinc-100 gap-2 px-3">
                                            <Plus className="h-3.5 w-3.5" />
                                            <span>Add Job</span>
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
                                                    value={newCronName ?? ""}
                                                    onChange={e => setNewCronName(e.target.value)}
                                                    placeholder="e.g. Midnight Sync"
                                                    className="bg-zinc-900/50 border-zinc-800 text-zinc-200"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-zinc-300">Cron Expression</Label>
                                                <Input
                                                    value={newCronExpression ?? ""}
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
                                            <div key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 hover:bg-zinc-800/20 transition-colors gap-4">
                                                <div className="space-y-1">
                                                    <div className="font-medium text-sm text-zinc-200">{job.name}</div>
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <div className="text-[10px] text-zinc-500 font-mono bg-zinc-950/40 px-1.5 py-0.5 rounded border border-zinc-800/50 w-fit">{job.expression}</div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                                                                <History className="w-3 h-3" />
                                                                <span>{job.lastRun ? format(new Date(job.lastRun), "MMM d, HH:mm") : 'Never'}</span>
                                                            </div>
                                                            {job.isActive && job.nextRun && (
                                                                <div className="flex items-center gap-1 text-[10px] text-blue-500/70 font-medium">
                                                                    <Clock className="w-3 h-3" />
                                                                    <span>Next: {format(new Date(job.nextRun), "MMM d, HH:mm")}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 self-end sm:self-center">
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

                        {/* User Mapping & Blacklist */}
                        <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden">
                            <CardHeader className="border-b border-zinc-800/40 bg-zinc-900/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <CardTitle className="text-base text-zinc-200">User Directory & Blacklist</CardTitle>
                                        {hasUserChanges && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 animate-pulse">
                                                <AlertCircle className="w-3 h-3 text-amber-500" />
                                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-tight">Unsaved Changes</span>
                                            </div>
                                        )}
                                    </div>
                                    <CardDescription className="text-zinc-500">Map usernames to real names and exclude users from monitor</CardDescription>
                                </div>
                                <Button
                                    onClick={handleSaveUsers}
                                    size="sm"
                                    className={cn(
                                        "font-medium shrink-0 transition-all active:scale-[0.98] cursor-pointer hover:shadow-md",
                                        hasUserChanges
                                            ? "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                                            : "bg-zinc-100 text-zinc-900 hover:bg-white"
                                    )}
                                >
                                    <Save className="h-4 w-4 mr-2" /> Save user settings
                                </Button>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                    <Input
                                        placeholder="Search usernames..."
                                        className="pl-9 bg-zinc-950 border-zinc-800 text-sm h-10"
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                    />
                                </div>

                                <div className="max-h-[400px] overflow-y-auto border border-zinc-800/50 rounded-xl divide-y divide-zinc-800/40 bg-zinc-900/30 custom-scrollbar">
                                    {availableUsers
                                        .filter(u => u.toLowerCase().includes(userSearch.toLowerCase()))
                                        .map(username => {
                                            const isBlacklisted = blacklist.includes(username);
                                            return (
                                                <div
                                                    key={username}
                                                    className={cn(
                                                        "p-4 grid grid-cols-1 sm:grid-cols-[200px_1fr_auto] items-center gap-x-8 gap-y-4 transition-all border-l-4",
                                                        isBlacklisted
                                                            ? "bg-red-500/5 border-l-red-600/50 opacity-80"
                                                            : "hover:bg-zinc-800/20 border-l-transparent"
                                                    )}
                                                >
                                                    <div className="space-y-0.5 min-w-0">
                                                        <div className="font-mono text-[10px] text-zinc-500 font-bold uppercase tracking-wider truncate">{username}</div>
                                                        <div className={cn(
                                                            "text-sm font-semibold truncate",
                                                            isBlacklisted ? "text-zinc-400" : "text-zinc-200"
                                                        )}>
                                                            {userMappings[username] || <span className="text-zinc-600 italic font-normal">No display name</span>}
                                                        </div>
                                                    </div>

                                                    <div className="w-full max-w-[300px]">
                                                        <Input
                                                            placeholder="Assign real name..."
                                                            className="h-9 bg-zinc-950 border-zinc-800 text-sm focus-visible:ring-zinc-700 disabled:opacity-50"
                                                            value={userMappings[username] ?? ""}
                                                            onChange={(e) => updateUserMapping(username, e.target.value)}
                                                            disabled={isBlacklisted}
                                                        />
                                                    </div>

                                                    <div className={cn(
                                                        "flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors sm:ml-auto",
                                                        isBlacklisted
                                                            ? "bg-red-600/10 border-red-500/30"
                                                            : "border-zinc-800/60 bg-zinc-950/40"
                                                    )}>
                                                        <Label className={cn(
                                                            "text-xs font-black uppercase whitespace-nowrap tracking-tighter",
                                                            isBlacklisted ? "text-red-400" : "text-zinc-500"
                                                        )}>Blacklist</Label>
                                                        <Switch
                                                            checked={isBlacklisted}
                                                            onCheckedChange={() => toggleBlacklist(username)}
                                                            className="data-[state=checked]:bg-red-600 scale-90"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            </CardContent>
                        </Card>

                        {/* Threshold Settings */}
                        <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden">
                            <CardHeader className="border-b border-zinc-800/40 bg-zinc-900/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-base text-zinc-200">Performance Thresholds</CardTitle>
                                    <CardDescription className="text-zinc-500">Configure score boundaries per workflow</CardDescription>
                                </div>
                                <Button onClick={handleUpdateThresholds} size="sm" className="bg-zinc-100 text-zinc-900 hover:bg-white font-medium shrink-0 transition-all active:scale-[0.98] cursor-pointer hover:shadow-md">
                                    <Save className="h-4 w-4 mr-2" /> Save Thresholds
                                </Button>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <form onSubmit={handleUpdateThresholds} className="space-y-10">
                                    {configGroups.map((group) => (
                                        <div key={group.title} className="space-y-4">
                                            <h3 className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em] px-1">{group.title}</h3>
                                            <div className={cn(
                                                "grid grid-cols-1 gap-4",
                                                group.keys.length === 3 ? "lg:grid-cols-3" : "sm:grid-cols-2"
                                            )}>
                                                {group.keys.map((cfg) => {
                                                    const tValues = thresholds[cfg.id] || { emerald: 100, blue: 60, orange: 40, red: 0 };
                                                    const maxVal = Math.max(tValues.emerald * 1.2, 100);

                                                    return (
                                                        <div key={cfg.id} className="p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/30 space-y-5">
                                                            <h4 className="font-semibold text-sm text-zinc-200">{cfg.label}</h4>

                                                            {/* 7.2: Live Preview Bar */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                                                                    <span>Spectrum Preview</span>
                                                                    <span>Max {Math.round(maxVal)}</span>
                                                                </div>
                                                                <div className="h-2 w-full flex rounded-full overflow-hidden bg-zinc-800/50 border border-zinc-800/50">
                                                                    <div style={{ width: `${(tValues.red / maxVal) * 100}%` }} className="h-full bg-red-600/40" />
                                                                    <div style={{ width: `${((tValues.orange - tValues.red) / maxVal) * 100}%` }} className="h-full bg-orange-500/50" />
                                                                    <div style={{ width: `${((tValues.blue - tValues.orange) / maxVal) * 100}%` }} className="h-full bg-blue-500/50" />
                                                                    <div style={{ width: `${((tValues.emerald - tValues.blue) / maxVal) * 100}%` }} className="h-full bg-emerald-500/50" />
                                                                    <div className="flex-1 bg-emerald-500" />
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                                                {/* 7.1: Semantic Labels */}
                                                                <div className="space-y-1.5 flex flex-col">
                                                                    <Label className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Excellent &ge;</Label>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 bg-zinc-950 border-zinc-800 text-sm focus-visible:ring-emerald-500/50"
                                                                        value={tValues.emerald ?? ""}
                                                                        onChange={(e) => updateSingleThreshold(cfg.id, 'emerald', Number(e.target.value))}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5 flex flex-col">
                                                                    <Label className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Good &ge;</Label>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 bg-zinc-950 border-zinc-800 text-sm focus-visible:ring-blue-500/50"
                                                                        value={tValues.blue ?? ""}
                                                                        onChange={(e) => updateSingleThreshold(cfg.id, 'blue', Number(e.target.value))}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5 flex flex-col">
                                                                    <Label className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Needs Work &ge;</Label>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 bg-zinc-950 border-zinc-800 text-sm focus-visible:ring-orange-500/50"
                                                                        value={tValues.orange ?? ""}
                                                                        onChange={(e) => updateSingleThreshold(cfg.id, 'orange', Number(e.target.value))}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5 flex flex-col">
                                                                    <Label className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Critical &ge;</Label>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 bg-zinc-950 border-zinc-800 text-sm focus-visible:ring-red-500/50"
                                                                        value={tValues.red ?? ""}
                                                                        onChange={(e) => updateSingleThreshold(cfg.id, 'red', Number(e.target.value))}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </form>
                            </CardContent>
                        </Card>

                        {/* Logs */}
                        <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden gap-0">
                            <CardHeader className="border-b border-zinc-800/40 bg-zinc-900/10 pb-6">
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
                                                <TableHead className="py-3 text-xs font-medium tracking-wider text-zinc-500 uppercase">Status</TableHead>
                                                <TableHead className="py-3 text-xs font-medium tracking-wider text-zinc-500 uppercase">Type</TableHead>
                                                <TableHead className="py-3 text-xs font-medium tracking-wider text-zinc-500 uppercase">Timestamp</TableHead>
                                                <TableHead className="py-3 text-xs font-medium tracking-wider text-zinc-500 uppercase text-right">Duration</TableHead>
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

            {/* Version Display in Dev Footer */}
            <div className="max-w-7xl mx-auto mt-8 px-4 flex justify-end">
                <div className="flex items-center gap-2 text-zinc-700">
                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Version</span>
                    <span className="text-[10px] font-mono leading-none">{version}</span>
                </div>
            </div>
        </div>
    );
}
