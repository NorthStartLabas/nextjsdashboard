"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Line } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowRight, Box, Layers, Users, Zap, Search, ClipboardList, Timer, Divide, Trophy, User, Activity, Clock } from "lucide-react";

export default function PickingMonitor({ title, type }: { title: any, type: any }) {
    const [data, setData] = useState({ daily: [], hourly: [] });
    const [thresholds, setThresholds] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [activeFlow, setActiveFlow] = useState('A-flow');
    const [selectedFloors, setSelectedFloors] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const [selectedUser, setSelectedUser] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [res, threshRes] = await Promise.all([
                    fetch(`/api/dashboard-data?type=${type}`),
                    fetch(`/api/thresholds`)
                ]);
                const result = await res.json();
                const threshData = await threshRes.json();
                setThresholds(threshData);

                if (result.success) {
                    setData(result.data);

                    // Auto-select all available floors except unknown_floor
                    const allFloors = Array.from(new Set(result.data.daily.map((d: any) => d.FLOOR)))
                        .filter(Boolean)
                        .filter(f => f !== 'unknown_floor');
                    setSelectedFloors(allFloors as string[]);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [type]);

    const handleFloorToggle = (floor: string) => {
        setSelectedFloors(prev =>
            prev.includes(floor) ? prev.filter(f => f !== floor) : [...prev, floor]
        );
    };

    // ----- Data Derivations -----
    const availableFloors = useMemo(() => {
        return Array.from(new Set(data.daily.map((d: any) => d.FLOOR)))
            .filter(Boolean)
            .filter(f => f !== 'unknown_floor')
            .sort();
    }, [data.daily]);

    const filteredDaily = useMemo(() => {
        return data.daily.filter((row: any) =>
            row.FLOW === activeFlow &&
            selectedFloors.includes(row.FLOOR) &&
            (row.QNAME?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
        ).sort((a: any, b: any) => b.LINES_PICKED - a.LINES_PICKED);
    }, [data.daily, activeFlow, selectedFloors, searchQuery]);

    const chartData = useMemo(() => {
        const hourlyFiltered = data.hourly.filter((row: any) =>
            row.FLOW === activeFlow && selectedFloors.includes(row.FLOOR)
        );

        const byHour: Record<number, { lines: number, users: Set<string> }> = {};

        for (let i = 0; i < 24; i++) {
            byHour[i] = { lines: 0, users: new Set() };
        }

        hourlyFiltered.forEach((row: any) => {
            if (row.HOUR >= 0 && row.HOUR < 24) {
                byHour[row.HOUR].lines += row.LINES_PICKED;
                if (row.LINES_PICKED > 0) {
                    byHour[row.HOUR].users.add(row.QNAME);
                }
            }
        });

        return Object.entries(byHour).map(([hour, stats]) => ({
            hour: `${hour.padStart(2, '0')}:00`,
            lines: stats.lines,
            users: stats.users.size
        })).filter(d => d.lines > 0 || d.users > 0);
    }, [data.hourly, activeFlow, selectedFloors]);

    const cascadeData = useMemo(() => {
        if (!selectedUser) return [];

        return data.hourly
            .filter((row: any) =>
                row.QNAME === selectedUser &&
                row.FLOW === activeFlow &&
                selectedFloors.includes(row.FLOOR)
            )
            .sort((a: any, b: any) => a.HOUR - b.HOUR);
    }, [data.hourly, selectedUser, activeFlow, selectedFloors]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-zinc-400">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-zinc-800 border-t-white rounded-full mb-4"
                />
                <p className="text-sm font-medium tracking-tight">Loading Data...</p>
            </div>
        );
    }

    const currentThresholds = thresholds?.[`${type}_${activeFlow.charAt(0)}`] || { emerald: 100, blue: 60, orange: 40, red: 0 };

    const getPerformanceBg = (score: number) => {
        if (score >= currentThresholds.emerald) return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
        if (score >= currentThresholds.blue) return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
        if (score >= currentThresholds.orange) return "bg-orange-500/10 text-orange-400 border border-orange-500/20";
        return "bg-red-500/10 text-red-500 border border-red-500/20";
    };

    const getPerformanceText = (score: number) => {
        if (score >= currentThresholds.emerald) return "text-emerald-400";
        if (score >= currentThresholds.blue) return "text-blue-400";
        if (score >= currentThresholds.orange) return "text-orange-400";
        return "text-red-500";
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-8 font-sans selection:bg-white/10 selection:text-white">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-4 border-b border-zinc-900/50">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                                {title}
                            </h1>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute animate-ping opacity-20" />
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 relative" />
                                Live
                            </span>
                        </div>
                        <p className="text-sm text-zinc-400 font-medium">
                            Real-time picking analytics and performance metrics
                        </p>
                    </div>

                    <div className="flex p-1 bg-zinc-900/50 rounded-lg border border-zinc-800/60 backdrop-blur-md">
                        {['A-flow', 'B-flow'].map((flow) => (
                            <button
                                key={flow}
                                onClick={() => setActiveFlow(flow)}
                                className={cn(
                                    "relative px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
                                    activeFlow === flow ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                                )}
                            >
                                {activeFlow === flow && (
                                    <motion.div
                                        layoutId="activeFlow"
                                        className="absolute inset-0 bg-white/10 border border-white/20 rounded-md"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10">{flow.replace('-', ' ')}</span>
                            </button>
                        ))}
                    </div>
                </header>

                {/* Chart Section */}
                <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden">
                    <CardHeader className="pb-2 border-b border-zinc-800/40 bg-zinc-900/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-zinc-800/50 rounded-md">
                                    <Activity className="w-4 h-4 text-zinc-400" />
                                </div>
                                <CardTitle className="text-base font-medium text-zinc-200">Hourly Performance</CardTitle>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 pb-2">
                        {chartData.length > 0 ? (
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                        <CartesianGrid strokeDasharray="4 4" stroke="#27272a" vertical={false} />
                                        <XAxis
                                            dataKey="hour"
                                            stroke="#52525b"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            dy={10}
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            stroke="#52525b"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(val) => `${val}`}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            stroke="#52525b"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            hide
                                        />
                                        <RechartsTooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                            contentStyle={{
                                                backgroundColor: '#09090b',
                                                border: '1px solid #27272a',
                                                borderRadius: '8px',
                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                                                padding: '12px'
                                            }}
                                            itemStyle={{ fontSize: '13px', color: '#e4e4e7' }}
                                            labelStyle={{ color: '#a1a1aa', marginBottom: '8px', fontSize: '12px' }}
                                        />
                                        <Bar
                                            yAxisId="left"
                                            dataKey="lines"
                                            name="Lines Picked"
                                            fill="#3b82f6"
                                            radius={[4, 4, 0, 0]}
                                            barSize={32}
                                            fillOpacity={0.8}
                                        />
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="users"
                                            name="Active Users"
                                            stroke="#e4e4e7"
                                            strokeWidth={2}
                                            dot={{ r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#e4e4e7' }}
                                            activeDot={{ r: 5, strokeWidth: 0, fill: '#fff' }}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[300px] flex flex-col items-center justify-center text-zinc-500 gap-3">
                                <Box className="h-8 w-8 opacity-20" />
                                <p className="text-sm font-medium">No data available for this selection</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Filters Section */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Search by operator..."
                            className="h-10 pl-9 bg-zinc-900/30 border-zinc-800/50 text-sm font-medium placeholder:text-zinc-500 focus-visible:ring-zinc-700 rounded-xl"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-4 bg-zinc-900/30 p-2 rounded-xl border border-zinc-800/50">
                        {availableFloors.map(floor => (
                            <Label
                                key={floor as string}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors border select-none",
                                    selectedFloors.includes(floor as string)
                                        ? "bg-white/10 border-white/20 text-zinc-100"
                                        : "bg-transparent border-transparent text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-300"
                                )}
                            >
                                <Checkbox
                                    checked={selectedFloors.includes(floor as string)}
                                    onCheckedChange={() => handleFloorToggle(floor as string)}
                                    className="hidden"
                                />
                                <Layers className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold uppercase tracking-wider">
                                    {(floor as string).replace('_', ' ')}
                                </span>
                            </Label>
                        ))}
                    </div>
                </div>

                {/* Data Table */}
                <div className="rounded-2xl border border-zinc-800/40 bg-zinc-900/20 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-zinc-900/60 hover:bg-zinc-900/60 border-b border-zinc-800/40">
                            <TableRow className="border-none hover:bg-transparent">
                                <TableHead className="py-4 pl-6 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Operator</TableHead>
                                <TableHead className="py-4 text-center text-xs font-semibold tracking-wider text-zinc-400 uppercase">Activity</TableHead>
                                <TableHead className="py-4 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase">Ratio</TableHead>
                                <TableHead className="py-4 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase">Effort</TableHead>
                                <TableHead className="py-4 pr-6 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase">Performance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <AnimatePresence mode="popLayout">
                                {filteredDaily.length > 0 ? (
                                    filteredDaily.map((row: any, idx: number) => (
                                        <motion.tr
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            key={`${row.QNAME}-${row.FLOOR}-${idx}`}
                                            className="group cursor-pointer border-b border-zinc-800/20 hover:bg-zinc-800/30 transition-colors"
                                            onClick={() => setSelectedUser(row.QNAME)}
                                        >
                                            <TableCell className="py-4 pl-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-medium text-zinc-100 group-hover:text-blue-400 transition-colors">
                                                        {row.QNAME}
                                                    </span>
                                                    <span className="text-[10px] font-medium text-zinc-500 uppercase flex items-center gap-1">
                                                        <Layers className="w-3 h-3" />
                                                        {row.FLOOR?.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex flex-col items-center justify-center gap-1">
                                                    <span className="text-sm font-medium text-zinc-200 tabular-nums">
                                                        {row.LINES_PICKED} <span className="text-[10px] text-zinc-500 uppercase ml-0.5">lines</span>
                                                    </span>
                                                    <div className="w-8 h-px bg-zinc-800/50"></div>
                                                    <span className="text-xs font-medium text-zinc-400 tabular-nums">
                                                        {row.ITEMS_PICKED} <span className="text-[9px] uppercase">units</span>
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-right">
                                                <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 text-xs font-mono font-medium text-zinc-400 bg-zinc-800/30 rounded-md border border-zinc-800/50">
                                                    {row.RATIO}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-4 text-right">
                                                <span className="text-sm font-medium text-zinc-300 tabular-nums flex items-center justify-end gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                                                    {row.EFFORT}h
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-4 pr-6 text-right">
                                                <div className="flex justify-end pr-2">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold tabular-nums",
                                                        getPerformanceBg(row.PRODUCTIVITY)
                                                    )}>
                                                        {row.PRODUCTIVITY}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        </motion.tr>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-40 text-center border-none">
                                            <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                                                <Search className="w-8 h-8 opacity-20 mb-2" />
                                                <p className="text-sm font-medium">No operators found matching the criteria.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </AnimatePresence>
                        </TableBody>
                    </Table>
                </div>

                {/* Cascade View Modal */}
                <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
                    <DialogContent className="max-w-3xl bg-[#09090b] border-zinc-800/60 shadow-2xl p-0 overflow-hidden sm:rounded-2xl">
                        <DialogHeader className="p-6 pb-0">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-2 sm:p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                                    <User className="w-6 h-6 sm:w-8 sm:h-8" />
                                </div>
                                <div className="text-left space-y-1">
                                    <DialogTitle className="text-xl sm:text-2xl font-semibold text-zinc-100">
                                        {selectedUser}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs sm:text-sm font-medium text-zinc-400 flex items-center gap-2">
                                        <Activity className="w-3.5 h-3.5" />
                                        Hourly Breakdown • {activeFlow.replace('-', ' ')}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-3 custom-scrollbar">
                            {cascadeData.length > 0 ? (
                                cascadeData.map((hourRow: any, i) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        key={i}
                                        className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center p-4 rounded-xl border border-zinc-800/40 bg-zinc-900/30 hover:bg-zinc-800/30 transition-colors"
                                    >
                                        <div className="shrink-0 rounded-lg bg-zinc-950 px-4 py-2 border border-zinc-800 shadow-inner">
                                            <span className="text-lg font-mono font-semibold text-zinc-200">
                                                {String(hourRow.HOUR).padStart(2, '0')}:00
                                            </span>
                                        </div>

                                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Layers className="w-3 h-3" /> Lines
                                                </span>
                                                <span className="text-base sm:text-xl font-medium text-zinc-200 tabular-nums">
                                                    {hourRow.LINES_PICKED}
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Box className="w-3 h-3" /> Units
                                                </span>
                                                <span className="text-base sm:text-xl font-medium text-zinc-300 tabular-nums">
                                                    {hourRow.ITEMS_PICKED}
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Divide className="w-3 h-3" /> Ratio
                                                </span>
                                                <span className="text-sm font-mono font-medium text-zinc-400 tabular-nums bg-zinc-950/50 px-2 py-0.5 rounded border border-zinc-900 w-fit mt-1 block">
                                                    {hourRow.RATIO}
                                                </span>
                                            </div>
                                            <div className="space-y-1 sm:text-right">
                                                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider sm:justify-end flex items-center gap-1.5">
                                                    <Zap className="w-3 h-3 text-blue-400" /> Score
                                                </span>
                                                <span className={cn(
                                                    "text-lg sm:text-xl font-bold tabular-nums block mt-1",
                                                    getPerformanceText(hourRow.PRODUCTIVITY)
                                                )}>
                                                    {hourRow.PRODUCTIVITY}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-800/50 rounded-xl bg-zinc-900/10">
                                    <Clock className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm font-medium">No hourly data available for this operator.</p>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
