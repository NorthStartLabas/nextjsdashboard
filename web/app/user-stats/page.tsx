"use client";

import { useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User, Filter, Calendar, TrendingUp, AlertCircle, FileText, Clock, BarChart3, Database, ChevronDown, Check, LayoutGrid, Box, Target, Zap, Waves, Activity, Download, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function UserStatsPage() {
    const [qname, setQname] = useState("");
    const [lgnum, setLgnum] = useState("245");
    const [activity, setActivity] = useState<"picking" | "packing">("picking");
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<any[] | null>(null);

    // Filter states
    const [selectedYear, setSelectedYear] = useState<string>("All");
    const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

    // Fake loading bar logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (loading) {
            setProgress(0);
            interval = setInterval(() => {
                setProgress((prev) => {
                    if (prev < 90) {
                        return prev + Math.random() * 0.8; // Move slowly till 90%
                    }
                    return prev;
                });
            }, 500);
        } else if (!loading && progress > 0) {
            // Move faster till 100%
            const fastInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(fastInterval);
                        setTimeout(() => setProgress(0), 1000);
                        return 100;
                    }
                    return prev + 5;
                });
            }, 50);
        }
        return () => clearInterval(interval);
    }, [loading]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!qname.trim()) {
            toast.error("Please enter a username");
            return;
        }

        setLoading(true);
        setResults(null);

        try {
            const response = await fetch("/api/user-stats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    qname: qname.toUpperCase(),
                    lgnum,
                    activity
                }),
            });

            const result = await response.json();

            if (result.success) {
                setResults(result.data);
                // Reset filters when new data is loaded
                setSelectedYear("All");
                setSelectedWeeks([]);
                setSelectedDays([]);
                setExpandedWeeks(new Set());
                toast.success(`Data found for ${qname.toUpperCase()}`);
            } else {
                toast.error(result.error || "User not found in the database");
            }
        } catch (error) {
            console.error("Fetch error:", error);
            toast.error("An error occurred while fetching data");
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (!results || results.length === 0) return;

        const headers = activity === 'picking'
            ? ["Date", "Day", "Year", "Week", "Total Picks", "Total Items", "Ratio", "Effort", "Performance"]
            : ["Date", "Day", "Year", "Week", "Boxes Packed", "Effort", "Performance"];

        const rows = filteredDraft.map(r => (
            activity === 'picking'
                ? [r.DATE, r.DAY_NAME, r.YEAR, r.WEEK, r.TOTAL_LINES, r.TOTAL_ITEMS, r.RATIO, r.TOTAL_EFFORT, r.PRODUCTIVITY]
                : [r.DATE, r.DAY_NAME, r.YEAR, r.WEEK, r.TOTAL_LINES, r.TOTAL_EFFORT, r.PRODUCTIVITY]
        ));

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${qname.toUpperCase()}_${activity}_stats.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Derived data
    const availableYears = Array.from(new Set(results?.map(r => String(r.YEAR)) || [])).sort().reverse();

    // availableWeeks should depend on selectedYear
    const availableWeeks = Array.from(new Set(
        results?.filter(r => selectedYear === "All" || String(r.YEAR) === selectedYear)
            .map(r => r.WEEK) || []
    )).sort((a, b) => a - b);

    const availableDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const filteredDraft = results?.filter(row => {
        const yearMatch = selectedYear === "All" || String(row.YEAR) === selectedYear;
        const weekMatch = selectedWeeks.length === 0 || selectedWeeks.includes(row.WEEK);
        const dayMatch = selectedDays.length === 0 || selectedDays.includes(row.DAY_NAME);
        return yearMatch && weekMatch && dayMatch;
    }) || [];

    // Group filtered results by week for the main table
    const weeklyGroups = filteredDraft.reduce((acc: any[], curr) => {
        const key = `${curr.YEAR}-W${curr.WEEK}`;
        let group = acc.find(g => g.key === key);
        if (!group) {
            group = {
                key,
                YEAR: curr.YEAR,
                WEEK: curr.WEEK,
                TOTAL_LINES: 0,
                TOTAL_ITEMS: 0,
                TOTAL_EFFORT: 0,
                days: []
            };
            acc.push(group);
        }
        group.TOTAL_LINES += curr.TOTAL_LINES;
        group.TOTAL_ITEMS += curr.TOTAL_ITEMS;
        group.TOTAL_EFFORT += curr.TOTAL_EFFORT;
        group.days.push(curr);
        return acc;
    }, []).map(g => ({
        ...g,
        RATIO: g.TOTAL_LINES > 0 ? (g.TOTAL_ITEMS / g.TOTAL_LINES).toFixed(2) : "0.00",
        PRODUCTIVITY: g.TOTAL_EFFORT > 0 ? (g.TOTAL_LINES / g.TOTAL_EFFORT).toFixed(2) : "0.00"
    }));

    const summary = filteredDraft.reduce((acc, curr) => {
        acc.lines += curr.TOTAL_LINES;
        acc.items += curr.TOTAL_ITEMS;
        acc.effort += curr.TOTAL_EFFORT;
        return acc;
    }, { lines: 0, items: 0, effort: 0 });

    const avgRatio = summary.lines > 0 ? (summary.items / summary.lines).toFixed(2) : "0.00";
    const avgPerformance = summary.effort > 0 ? (summary.lines / summary.effort).toFixed(2) : "0.00";

    const toggleWeek = (week: number) => {
        setSelectedWeeks(prev =>
            prev.includes(week) ? prev.filter(w => w !== week) : [...prev, week]
        );
    };

    const toggleDay = (day: string) => {
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const toggleExpand = (key: string) => {
        setExpandedWeeks(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleYearChange = (year: string) => {
        setSelectedYear(year);
        setSelectedWeeks([]);
        setSelectedDays([]);
        setExpandedWeeks(new Set());
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-12 font-sans selection:bg-blue-500/30">
            <div className="max-w-6xl mx-auto space-y-12">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-4 border-b border-zinc-900/50">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                                <Search className="w-6 h-6 text-blue-500" />
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                                User Performance Insights
                            </h1>
                        </div>
                        <p className="text-sm text-zinc-400 font-medium">
                            Track operator productivity trends and historical performance metrics.
                        </p>
                    </div>
                </header>

                {/* Search Card */}
                <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-zinc-800/40 bg-zinc-900/10">
                        <CardTitle className="text-base text-zinc-200">Search Parameters</CardTitle>
                        <CardDescription className="text-zinc-500">Configure filters to locate specific records</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-6 items-end">
                            <div className="flex-1 space-y-2 w-full">
                                <label className="text-xs font-medium text-zinc-500 uppercase ml-1">Username</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                    <Input
                                        placeholder="E.g. BUTERL2"
                                        value={qname}
                                        onChange={(e) => setQname(e.target.value)}
                                        className="bg-zinc-950/50 border-zinc-800 focus-visible:ring-blue-500/50 h-11 pl-10 rounded-xl text-lg font-medium"
                                    />
                                </div>
                            </div>

                            <div className="w-full md:w-48 space-y-2">
                                <label className="text-xs font-medium text-zinc-500 uppercase ml-1">Warehouse</label>
                                <Select value={lgnum} onValueChange={setLgnum}>
                                    <SelectTrigger className="bg-zinc-950/50 border-zinc-800 h-11 w-full rounded-xl focus:ring-zinc-700 flex items-center px-4">
                                        <SelectValue placeholder="Dept" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-950 border-zinc-800">
                                        <SelectItem value="245">245 (MS)</SelectItem>
                                        <SelectItem value="266">266 (CVNS)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-full md:w-48 space-y-2">
                                <label className="text-xs font-medium text-zinc-500 uppercase ml-1">Activity</label>
                                <div className="flex p-1 bg-zinc-950/50 rounded-xl border border-zinc-800 h-11">
                                    {(['picking', 'packing'] as const).map((act) => (
                                        <button
                                            key={act}
                                            type="button"
                                            onClick={() => {
                                                setActivity(act);
                                                setResults(null);
                                            }}
                                            className={cn(
                                                "relative flex-1 flex items-center justify-center gap-2 rounded-lg text-xs font-bold uppercase transition-all duration-200 ease-out outline-none",
                                                activity === act
                                                    ? "text-white"
                                                    : "text-zinc-500 hover:text-zinc-300"
                                            )}
                                        >
                                            {activity === act && (
                                                <motion.div
                                                    layoutId="activeActivity"
                                                    className="absolute inset-0 bg-blue-600 rounded-lg shadow-lg"
                                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                />
                                            )}
                                            <span className="relative z-10 flex items-center gap-2">
                                                {act === 'picking' ? <Target className="w-3 h-3" /> : <Box className="w-3 h-3" />}
                                                {act}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="h-11 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:grayscale"
                            >
                                {loading ? "Analyzing..." : "Search Records"}
                                <Search className="ml-2 w-4 h-4" />
                            </Button>
                        </form>
                    </CardContent>

                    {/* Loading Bar */}
                    <AnimatePresence>
                        {progress > 0 && (
                            <div className="h-1 w-full bg-zinc-950">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                                    className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                />
                            </div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* Results Section */}
                <div className="space-y-6">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="p-3 bg-zinc-900 rounded-full border border-zinc-800"
                            >
                                <Database className="w-8 h-8 text-blue-500 animate-pulse" />
                            </motion.div>
                            <div className="text-center">
                                <p className="text-sm font-medium text-zinc-300">Fetching records from Snowflake...</p>
                                <p className="text-xs text-zinc-500 mt-1">This may take up to 60 seconds for large datasets.</p>
                            </div>
                        </div>
                    )}

                    {results && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-8"
                        >
                            {/* Summary Cards */}
                            <div className={cn(
                                "grid gap-4",
                                activity === 'picking' ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-3"
                            )}>
                                {[
                                    { label: activity === 'picking' ? "Total Lines" : "Boxes Packed", value: summary.lines.toLocaleString(), description: "Cumulative output", icon: LayoutGrid, color: "text-blue-500" },
                                    ...(activity === 'picking' ? [
                                        { label: "Total Items", value: summary.items.toLocaleString(), description: "Total units processed", icon: Box, color: "text-purple-500" },
                                        { label: "Avg Ratio", value: avgRatio, description: "Items per line", icon: Target, color: "text-amber-500" }
                                    ] : []),
                                    { label: "Total Effort", value: `${summary.effort.toFixed(2)}h`, description: "Total time logged", icon: Clock, color: "text-orange-500" },
                                    { label: "Performance", value: avgPerformance, description: "Normalized score", icon: Activity, color: "text-emerald-500" },
                                ].map((stat, i) => (
                                    <Card key={i} className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl">
                                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200">
                                            <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                                            <stat.icon className={cn("h-4 w-4", stat.color)} />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-semibold">{stat.value}</div>
                                            <p className="text-xs text-zinc-500 font-medium mt-1">{stat.description}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {/* Filters Row */}
                            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-zinc-900/20 p-6 rounded-2xl border border-zinc-800/40">
                                <div className="space-y-4 w-full flex-1">
                                    <div className="flex items-center gap-2">
                                        <Filter className="w-4 h-4 text-zinc-500" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Apply Filters</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-4 items-center">
                                        <div className="w-32">
                                            <Select value={selectedYear} onValueChange={handleYearChange}>
                                                <SelectTrigger className="bg-zinc-950/50 border-zinc-800 h-9 rounded-lg text-xs">
                                                    <SelectValue placeholder="Year" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                                    <SelectItem value="All">All Years</SelectItem>
                                                    {availableYears.map(year => (
                                                        <SelectItem key={year} value={year}>{year}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="w-48">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full justify-between bg-zinc-950/50 border-zinc-800 h-9 rounded-lg text-xs font-medium text-zinc-400"
                                                    >
                                                        {selectedWeeks.length === 0
                                                            ? "Select Weeks"
                                                            : `${selectedWeeks.length} Weeks Selected`}
                                                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="bg-zinc-900 border-zinc-800 w-48 max-h-64 overflow-y-auto custom-scrollbar">
                                                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                                        Available Weeks ({selectedYear})
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuSeparator className="bg-zinc-800" />
                                                    {availableWeeks.map(week => (
                                                        <DropdownMenuCheckboxItem
                                                            key={week}
                                                            checked={selectedWeeks.includes(week)}
                                                            onCheckedChange={() => toggleWeek(week)}
                                                            onSelect={(e) => e.preventDefault()} // Keep dropdown open
                                                            className="text-xs focus:bg-zinc-800 focus:text-white"
                                                        >
                                                            Week {week}
                                                        </DropdownMenuCheckboxItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="w-48">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full justify-between bg-zinc-950/50 border-zinc-800 h-9 rounded-lg text-xs font-medium text-zinc-400"
                                                    >
                                                        {selectedDays.length === 0
                                                            ? "All Days"
                                                            : `${selectedDays.length} Days Selected`}
                                                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="bg-zinc-900 border-zinc-800 w-48 max-h-64 overflow-y-auto custom-scrollbar">
                                                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                                        Filter Days
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuSeparator className="bg-zinc-800" />
                                                    {availableDays.map(day => (
                                                        <DropdownMenuCheckboxItem
                                                            key={day}
                                                            checked={selectedDays.includes(day)}
                                                            onCheckedChange={() => toggleDay(day)}
                                                            onSelect={(e) => e.preventDefault()}
                                                            className="text-xs focus:bg-zinc-800 focus:text-white"
                                                        >
                                                            {day}
                                                        </DropdownMenuCheckboxItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <Button
                                            onClick={handleExportCSV}
                                            disabled={!results || results.length === 0}
                                            variant="outline"
                                            size="sm"
                                            className="h-9 gap-2 bg-emerald-600/10 border-emerald-/20 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all rounded-lg"
                                        >
                                            <Download className="w-4 h-4" />
                                            Export CSV
                                        </Button>

                                        {(selectedYear !== "All" || selectedWeeks.length > 0 || selectedDays.length > 0) && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => { setSelectedYear("All"); setSelectedWeeks([]); setSelectedDays([]); }}
                                                className="h-8 text-[10px] font-bold text-zinc-500 hover:text-white"
                                            >
                                                CLEAR FILTERS
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full whitespace-nowrap">
                                        {filteredDraft.length} Daily Records
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-zinc-800/40 bg-zinc-900/20 overflow-hidden shadow-xl overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-zinc-950/40">
                                        <TableRow className="border-zinc-800/50 hover:bg-transparent">
                                            <TableHead className="py-4 pl-6 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Week / Year</TableHead>
                                            <TableHead className="py-4 text-center text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                                {activity === 'picking' ? 'Total Picks' : 'Boxes Packed'}
                                            </TableHead>
                                            {activity === 'picking' && (
                                                <>
                                                    <TableHead className="py-4 text-center text-xs font-semibold tracking-wider text-zinc-400 uppercase">Total Items</TableHead>
                                                    <TableHead className="py-4 text-center text-xs font-semibold tracking-wider text-zinc-400 uppercase">Ratio</TableHead>
                                                </>
                                            )}
                                            <TableHead className="py-4 text-center text-xs font-semibold tracking-wider text-zinc-400 uppercase">Total Effort</TableHead>
                                            <TableHead className="py-4 pr-6 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase">Performance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <AnimatePresence mode="popLayout">
                                            {weeklyGroups.map((group) => (
                                                <Fragment key={group.key}>
                                                    <motion.tr
                                                        layout
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        onClick={() => toggleExpand(group.key)}
                                                        className={cn(
                                                            "border-zinc-800/40 group cursor-pointer transition-colors",
                                                            expandedWeeks.has(group.key) ? "bg-blue-600/10" : "hover:bg-blue-500/5"
                                                        )}
                                                    >
                                                        <TableCell className="py-4 pl-6">
                                                            <div className="flex items-center gap-3">
                                                                <motion.div
                                                                    animate={{ rotate: expandedWeeks.has(group.key) ? 90 : 0 }}
                                                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                                                >
                                                                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                                                                </motion.div>
                                                                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                                                                    {group.WEEK}
                                                                </div>
                                                                <span className="font-mono text-sm text-zinc-300">{group.YEAR}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-4 text-center font-medium">{group.TOTAL_LINES.toLocaleString()}</TableCell>
                                                        {activity === 'picking' && (
                                                            <>
                                                                <TableCell className="py-4 text-center text-zinc-400">{group.TOTAL_ITEMS.toLocaleString()}</TableCell>
                                                                <TableCell className="py-4 text-center">
                                                                    <span className="px-2 py-1 rounded-md bg-zinc-800/50 border border-zinc-700 font-mono text-xs text-zinc-400">
                                                                        {group.RATIO}
                                                                    </span>
                                                                </TableCell>
                                                            </>
                                                        )}
                                                        <TableCell className="py-4 text-center">
                                                            <div className="flex items-center justify-center gap-1.5 text-sm text-zinc-300">
                                                                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                                                                {group.TOTAL_EFFORT.toFixed(2)}h
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-4 pr-6 text-right">
                                                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold bg-zinc-800/30 text-white border border-zinc-700 shadow-sm">
                                                                {group.PRODUCTIVITY}
                                                            </span>
                                                        </TableCell>
                                                    </motion.tr>

                                                    <AnimatePresence>
                                                        {expandedWeeks.has(group.key) && (
                                                            <motion.tr
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: "auto" }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                                className="bg-zinc-950/30 overflow-hidden"
                                                            >
                                                                <TableCell colSpan={activity === 'picking' ? 6 : 4} className="p-0 border-b border-zinc-800/40">
                                                                    <div className="py-4 px-6 space-y-2">
                                                                        <div className="grid grid-cols-6 gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 pb-2 border-b border-zinc-800/20">
                                                                            <span className="col-span-1">Date / Day</span>
                                                                            <span className="text-center">{activity === 'picking' ? 'Picks' : 'Boxes'}</span>
                                                                            {activity === 'picking' && <span className="text-center">Items</span>}
                                                                            {activity === 'picking' && <span className="text-center">Ratio</span>}
                                                                            <span className="text-center">Effort</span>
                                                                            <span className="text-right">Perf.</span>
                                                                        </div>
                                                                        {group.days.map((day: any) => (
                                                                            <div key={day.DATE} className="grid grid-cols-6 gap-2 items-center py-2 border-b border-zinc-800/10 last:border-0 hover:bg-zinc-800/10 transition-colors rounded-lg px-2 -mx-2">
                                                                                <div className="col-span-1 flex flex-col">
                                                                                    <span className="text-xs font-mono text-zinc-300">{day.DATE}</span>
                                                                                    <span className="text-[10px] text-zinc-500 font-medium">{day.DAY_NAME}</span>
                                                                                </div>
                                                                                <div className="text-center text-xs font-medium text-zinc-200">{day.TOTAL_LINES}</div>
                                                                                {activity === 'picking' && <div className="text-center text-xs text-zinc-400">{day.TOTAL_ITEMS}</div>}
                                                                                {activity === 'picking' && <div className="text-center text-xs font-mono text-zinc-500">{day.RATIO}</div>}
                                                                                <div className="text-center text-xs text-zinc-400">{day.TOTAL_EFFORT}h</div>
                                                                                <div className="text-right">
                                                                                    <span className="text-xs font-bold text-white bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-700/50">{day.PRODUCTIVITY}</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </TableCell>
                                                            </motion.tr>
                                                        )}
                                                    </AnimatePresence>
                                                </Fragment>
                                            ))}
                                        </AnimatePresence>
                                        {filteredDraft.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-40 text-center text-zinc-500 italic">
                                                    No results match the selected filters.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </motion.div>
                    )}

                    {!results && !loading && (
                        <div className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800/50 rounded-3xl bg-zinc-900/10">
                            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 mb-4">
                                <FileText className="w-8 h-8 text-zinc-600" />
                            </div>
                            <h3 className="text-zinc-400 font-semibold text-lg mb-1">Ready to search</h3>
                            <p className="text-zinc-500 font-medium">Click <span className="text-blue-500">Search Records</span> to view {activity} data for this user.</p>
                            <p className="text-zinc-700 text-xs mt-2 uppercase tracking-widest font-bold">Historical data from 2025</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
