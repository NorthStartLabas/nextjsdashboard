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
import { ArrowRight, Box, Layers, Users, Zap, Search, ClipboardList, Timer, Divide, Trophy, User, Activity, Clock, Circle, Package } from "lucide-react";

export default function PackingMonitor({ title, type }: { title: string, type: 'ms' | 'cvns' }) {
    const [data, setData] = useState({ daily: [], hourly: [] });
    const [thresholds, setThresholds] = useState<any>(null);
    const [blacklist, setBlacklist] = useState<string[]>([]);
    const [userMappings, setUserMappings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const [activeFlow, setActiveFlow] = useState('A-flow');
    const [selectedFloors, setSelectedFloors] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [lastRefreshed, setLastRefreshed] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'BOXES_PACKED', direction: 'desc' });

    const [selectedUser, setSelectedUser] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const [res, threshRes, userRes] = await Promise.all([
                fetch(`/api/dashboard-data?type=${type}&activity=packing`),
                fetch(`/api/thresholds`),
                fetch(`/api/users`)
            ]);
            const result = await res.json();
            const threshData = await threshRes.json();
            const userData = await userRes.json();

            setThresholds(threshData);
            setBlacklist(userData.blacklist || []);
            setUserMappings(userData.userMappings || {});

            if (result.success) {
                setData(result.data);

                // Auto-select all available floors except unknown_floor
                const allFloors = Array.from(new Set(result.data.daily.map((d: any) => d.FLOOR)))
                    .filter(Boolean)
                    .filter(f => f !== 'unknown_floor');
                setSelectedFloors(allFloors as string[]);
            }
            setLastRefreshed(format(new Date(), "HH:mm:ss"));
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchData();

        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const ms = now.getMilliseconds();
        const minutesToWait = 5 - (minutes % 5);
        const timeToWait = (minutesToWait * 60 * 1000) - (seconds * 1000) - ms;

        let interval: NodeJS.Timeout;
        const timeout = setTimeout(() => {
            fetchData();
            interval = setInterval(fetchData, 5 * 60 * 1000);
        }, timeToWait);

        return () => {
            clearTimeout(timeout);
            if (interval) clearInterval(interval);
        };
    }, [type]);

    const handleFloorToggle = (floor: string) => {
        setSelectedFloors(prev =>
            prev.includes(floor) ? prev.filter(f => f !== floor) : [...prev, floor]
        );
    };

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    // ----- Data Derivations -----
    const availableFloors = useMemo(() => {
        return Array.from(new Set(data.daily.map((d: any) => d.FLOOR)))
            .filter(Boolean)
            .filter(f => f !== 'unknown_floor')
            .sort();
    }, [data.daily]);

    const filteredDaily = useMemo(() => {
        let sorted = data.daily.filter((row: any) => {
            // Filter by flow and floor
            if (row.FLOW !== activeFlow || !selectedFloors.includes(row.FLOOR)) return false;

            // MS Special: Exclude conveyor from table ONLY for B-flow
            if (type === 'ms' && activeFlow === 'B-flow' && row.QNAME === 'WEBMREMOTEWS') return false;

            // Blacklist check
            if (blacklist.includes(row.QNAME)) return false;

            // Search query
            const name = row.QNAME?.toLowerCase() || "";
            const mapping = userMappings[row.QNAME]?.toLowerCase() || "";
            const search = searchQuery.toLowerCase();
            return name.includes(search) || mapping.includes(search);
        });

        if (sortConfig) {
            sorted.sort((a: any, b: any) => {
                let aVal, bVal;
                switch (sortConfig.key) {
                    case 'BOXES_PACKED':
                        aVal = a.BOXES_PACKED;
                        bVal = b.BOXES_PACKED;
                        break;
                    case 'EFFORT':
                        aVal = parseFloat(a.EFFORT);
                        bVal = parseFloat(b.EFFORT);
                        break;
                    case 'PRODUCTIVITY':
                        aVal = parseFloat(a.PRODUCTIVITY);
                        bVal = parseFloat(b.PRODUCTIVITY);
                        break;
                    default:
                        aVal = 0;
                        bVal = 0;
                }
                if (sortConfig.direction === 'asc') return aVal - bVal;
                return bVal - aVal;
            });
        }

        return sorted;
    }, [data.daily, activeFlow, selectedFloors, searchQuery, blacklist, userMappings, type, sortConfig]);

    const chartData = useMemo(() => {
        const hourlyFiltered = data.hourly.filter((row: any) => {
            if (row.FLOW !== activeFlow || !selectedFloors.includes(row.FLOOR)) return false;

            // MS Special: Show ONLY conveyor in chart for B-flow
            if (type === 'ms' && activeFlow === 'B-flow') {
                return row.QNAME === 'WEBMREMOTEWS';
            }

            // CVNS: Show all non-blacklisted users
            return !blacklist.includes(row.QNAME);
        });

        const byHour: Record<number, { boxes: number, users: Set<string> }> = {};

        for (let i = 0; i < 24; i++) {
            byHour[i] = { boxes: 0, users: new Set() };
        }

        hourlyFiltered.forEach((row: any) => {
            if (row.HOUR >= 0 && row.HOUR < 24) {
                byHour[row.HOUR].boxes += row.BOXES_PACKED;
                if (row.BOXES_PACKED > 0) {
                    byHour[row.HOUR].users.add(row.QNAME);
                }
            }
        });

        return Object.entries(byHour).map(([hour, stats]) => ({
            hour: `${hour.padStart(2, '0')}:00`,
            boxes: stats.boxes,
            users: stats.users.size
        })).filter(d => d.boxes > 0 || d.users > 0);
    }, [data.hourly, activeFlow, selectedFloors, blacklist, type]);

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

    const activityMetrics = useMemo(() => {
        const now = new Date();
        const currentHour = now.getHours();
        const lastHour = currentHour === 0 ? 23 : currentHour - 1;

        const statusMap: Record<string, 'Active' | 'Idle' | 'Away'> = {};
        const activeToday = new Set<string>();

        const relevantHourly = data.hourly.filter((row: any) =>
            row.FLOW === activeFlow &&
            selectedFloors.includes(row.FLOOR) &&
            !blacklist.includes(row.QNAME) &&
            (type === 'ms' && activeFlow === 'B-flow' ? row.QNAME !== 'WEBMREMOTEWS' : true)
        );

        const userLastHour: Record<string, number> = {};
        relevantHourly.forEach((row: any) => {
            if (row.BOXES_PACKED > 0) {
                if (userLastHour[row.QNAME] === undefined || row.HOUR > userLastHour[row.QNAME]) {
                    userLastHour[row.QNAME] = row.HOUR;
                }
            }
        });

        filteredDaily.forEach((user: any) => {
            const lastH = userLastHour[user.QNAME];
            if (lastH === currentHour) {
                statusMap[user.QNAME] = 'Active';
                activeToday.add(user.QNAME);
            } else if (lastH === lastHour) {
                statusMap[user.QNAME] = 'Idle';
            } else {
                statusMap[user.QNAME] = 'Away';
            }
        });

        return {
            statusMap,
            activeThisHour: activeToday.size
        };
    }, [data.hourly, filteredDaily, activeFlow, selectedFloors, blacklist, type]);

    const getThresholdsForUser = (floor?: string) => {
        const flowKey = `${type}_packing_${activeFlow.charAt(0)}`;
        const specificKey = floor ? `${flowKey}_${floor}` : flowKey;
        return thresholds?.[specificKey] || thresholds?.[flowKey] || { emerald: 100, blue: 60, orange: 40, red: 0 };
    };

    const getPerformanceBg = (score: number, floor?: string) => {
        // Only show colors for CVNS B-flow
        const isCVNSB = type === 'cvns' && activeFlow === 'B-flow';

        if (!isCVNSB) return "bg-zinc-800/30 text-zinc-300 border border-zinc-700/50";

        const thresh = getThresholdsForUser(floor);
        if (score >= thresh.emerald) return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
        if (score >= thresh.blue) return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
        if (score >= thresh.orange) return "bg-orange-500/10 text-orange-400 border border-orange-500/20";
        return "bg-red-500/10 text-red-500 border border-red-500/20";
    };

    const getPerformanceText = (score: number, floor?: string) => {
        // Only show colors for CVNS B-flow
        const isCVNSB = type === 'cvns' && activeFlow === 'B-flow';

        if (!isCVNSB) return "text-zinc-300";

        const thresh = getThresholdsForUser(floor);
        if (score >= thresh.emerald) return "text-emerald-400";
        if (score >= thresh.blue) return "text-blue-500";
        if (score >= thresh.orange) return "text-orange-400";
        return "text-red-500";
    };

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

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-8 font-sans selection:bg-white/10 selection:text-white">
            <div className="max-w-7xl mx-auto space-y-8">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-4 border-b border-zinc-900/50">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                                <Package className="w-6 h-6 text-purple-500" />
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{title}</h1>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute animate-ping opacity-20" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 relative" />
                                    Live
                                </span>
                                {lastRefreshed && (
                                    <span className="text-[10px] text-zinc-500 font-medium">
                                        Last refreshed: {lastRefreshed}
                                    </span>
                                )}
                            </div>
                        </div>
                        <p className="text-sm text-zinc-400 font-medium">Real-time packing analytics and performance metrics</p>
                    </div>
                    <div className="flex p-1 bg-zinc-950/50 rounded-xl border border-zinc-800 h-11">
                        {['A-flow', 'B-flow'].map((flow) => (
                            <button
                                key={flow}
                                onClick={() => setActiveFlow(flow)}
                                className={cn(
                                    "relative px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ease-out outline-none",
                                    activeFlow === flow ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                                )}
                            >
                                {activeFlow === flow && (
                                    <motion.div
                                        layoutId="activeFlow"
                                        className="absolute inset-0 bg-blue-600 rounded-lg shadow-lg"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10">{flow.replace('-', ' ')}</span>
                            </button>
                        ))}
                    </div>
                </header>

                <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden">
                    <CardHeader className="pb-4 border-b border-zinc-800/40 bg-zinc-900/10">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-base text-zinc-200">
                                    {type === 'ms' && activeFlow === 'B-flow' ? 'Conveyor Activity' : 'Hourly Performance'}
                                </CardTitle>
                                <CardDescription className="text-zinc-500">
                                    {type === 'ms' && activeFlow === 'B-flow'
                                        ? 'Bars represent boxes processed by the conveyor system per hour.'
                                        : 'Bars represent total boxes packed per hour, while the white line tracks active personnel.'}
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 pb-2">
                        {chartData.length > 0 ? (
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                        <CartesianGrid strokeDasharray="4 4" stroke="#27272a" vertical={false} />
                                        <XAxis dataKey="hour" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis yAxisId="left" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis yAxisId="right" orientation="right" hide />
                                        <RechartsTooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                            contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
                                        />
                                        <Bar yAxisId="left" dataKey="boxes" name="Boxes Packed" fill={type === 'ms' && activeFlow === 'B-flow' ? '#10b981' : '#2563eb'} radius={[4, 4, 0, 0]} barSize={32} fillOpacity={0.8} />
                                        {!(type === 'ms' && activeFlow === 'B-flow') && (
                                            <Line yAxisId="right" type="monotone" dataKey="users" name="Active Users" stroke="#e4e4e7" strokeWidth={2} dot={{ r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#e4e4e7' }} activeDot={{ r: 5, strokeWidth: 0, fill: '#fff' }} />
                                        )}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[300px] flex flex-col items-center justify-center text-zinc-500 gap-3">
                                <Box className="h-8 w-8 opacity-20" />
                                <p className="text-sm font-medium">No data available</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Search by operator..."
                            className="h-10 pl-9 bg-zinc-900/30 border-zinc-800/50 rounded-xl"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600/10 border border-blue-600/20 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.05)]">
                            <Users className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">{activityMetrics.activeThisHour} Personnel Active</span>
                        </div>
                        {availableFloors.map(floor => (
                            <Label key={floor as string} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer border", selectedFloors.includes(floor as string) ? "bg-white/10 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/40")}>
                                <Checkbox checked={selectedFloors.includes(floor as string)} onCheckedChange={() => handleFloorToggle(floor as string)} className="hidden" />
                                <Layers className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold uppercase">{floor.replace('_', ' ')}</span>
                            </Label>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-800/40 bg-zinc-900/20 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-zinc-900/60 border-b border-zinc-800/40">
                            <TableRow className="border-none hover:bg-transparent">
                                <TableHead className="py-4 pl-6 text-xs font-semibold text-zinc-400 uppercase">Operator</TableHead>
                                <TableHead onClick={() => handleSort('BOXES_PACKED')} className="py-4 text-center text-xs font-semibold text-zinc-400 uppercase cursor-pointer hover:text-blue-500 transition-colors">
                                    Boxes Packed {sortConfig?.key === 'BOXES_PACKED' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </TableHead>
                                <TableHead onClick={() => handleSort('EFFORT')} className="py-4 text-right text-xs font-semibold text-zinc-400 uppercase cursor-pointer hover:text-blue-500 transition-colors">
                                    Effort {sortConfig?.key === 'EFFORT' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </TableHead>
                                <TableHead onClick={() => handleSort('PRODUCTIVITY')} className="py-4 pr-6 text-right text-xs font-semibold text-zinc-400 uppercase cursor-pointer hover:text-blue-500 transition-colors">
                                    Performance {sortConfig?.key === 'PRODUCTIVITY' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </TableHead>
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
                                            key={`${row.QNAME}-${row.FLOOR}-${idx}`}
                                            className="group cursor-pointer border-b border-zinc-800/20 hover:bg-zinc-800/30 transition-colors"
                                            onClick={() => setSelectedUser(row.QNAME)}
                                        >
                                            <TableCell className="py-4 pl-6">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold text-zinc-100 group-hover:text-[#2563eb] transition-colors">{userMappings[row.QNAME] || row.QNAME}</span>
                                                        {(() => {
                                                            const status = activityMetrics.statusMap[row.QNAME];
                                                            if (status === 'Active') return <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-[9px] text-emerald-500 border border-emerald-500/20">Active</span>;
                                                            if (status === 'Idle') return <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-[9px] text-amber-500 border border-amber-500/20">Idle</span>;
                                                            return <span className="px-1.5 py-0.5 rounded-full bg-zinc-500/10 text-[9px] text-zinc-500 border border-zinc-800">Away</span>;
                                                        })()}
                                                    </div>
                                                    <span className="text-[10px] text-zinc-500 uppercase flex items-center gap-1">
                                                        <Layers className="w-3 h-3" /> {row.FLOOR?.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <span className="text-sm font-medium text-zinc-200">{row.BOXES_PACKED} <span className="text-[10px] text-zinc-500 uppercase ml-0.5">boxes</span></span>
                                            </TableCell>
                                            <TableCell className="py-4 text-right">
                                                <span className="text-sm font-medium text-zinc-300 flex items-center justify-end gap-1.5"><Clock className="w-3.5 h-3.5 text-zinc-500" />{row.EFFORT}h</span>
                                            </TableCell>
                                            <TableCell className="py-4 pr-6 text-right">
                                                <div className="flex justify-end pr-2">
                                                    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold", getPerformanceBg(row.PRODUCTIVITY, row.FLOOR))}>
                                                        {row.PRODUCTIVITY}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        </motion.tr>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={4} className="h-40 text-center border-none">No operators found</TableCell></TableRow>
                                )}
                            </AnimatePresence>
                        </TableBody>
                    </Table>
                </div>

                <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
                    <DialogContent className="max-w-5xl bg-[#09090b] border-zinc-800/60 p-0 overflow-hidden sm:rounded-2xl shadow-2xl">
                        <DialogHeader className="p-6 pb-0">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-2 sm:p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20"><User className="w-6 h-6 sm:w-8 sm:h-8" /></div>
                                <div className="text-left space-y-1">
                                    <DialogTitle className="text-xl sm:text-2xl font-semibold text-zinc-100">{userMappings[selectedUser || ""] || selectedUser}</DialogTitle>
                                    <DialogDescription className="text-xs sm:text-sm font-medium text-zinc-400">
                                        {selectedUser} • Hourly Breakdown • {activeFlow.replace('-', ' ')}
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
                                        className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center p-4 rounded-xl border border-zinc-800/40 bg-zinc-900/10 hover:bg-zinc-800/30 transition-colors"
                                    >
                                        <div className="shrink-0 px-2 py-1">
                                            <span className="text-lg font-mono font-semibold text-zinc-400">
                                                {String(hourRow.HOUR).padStart(2, '0')}:00
                                            </span>
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-8 w-full">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                                                    Boxes
                                                </span>
                                                <span className="text-base sm:text-xl font-medium text-zinc-200 tabular-nums">
                                                    {hourRow.BOXES_PACKED}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider justify-end block">
                                                    Performance
                                                </span>
                                                <span className={cn("text-lg sm:text-xl font-bold block mt-1", getPerformanceText(hourRow.PRODUCTIVITY, hourRow.FLOOR))}>
                                                    {hourRow.PRODUCTIVITY}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (<div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-800/50 rounded-xl bg-zinc-900/10">
                                <Clock className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-medium">No hourly data available for this operator.</p>
                            </div>)}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
