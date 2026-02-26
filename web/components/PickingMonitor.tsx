"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Line } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowRight, Box, Layers, Users, Zap, Search, ClipboardList, Timer, Divide, Trophy, User, Activity, Clock, Circle, HelpCircle, Download, ChevronDown, ChevronRight } from "lucide-react";
import { Fragment } from "react";

// Explanation Section Component
const MetricsLegend = () => (
    <Card className="bg-zinc-900/10 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden mb-6">
        <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-zinc-400">
                        <div className="p-1.5 bg-zinc-800/50 rounded-lg">
                            <Divide className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Ratio</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                        Items picked per line. A high ratio indicates complex <span className="text-zinc-300">multi-picking</span> or counting tasks.
                    </p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-zinc-400">
                        <div className="p-1.5 bg-zinc-800/50 rounded-lg">
                            <Layers className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Intensity Context</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-3 bg-blue-500 rounded-full" />
                            <span className="text-[10px] text-zinc-400 font-bold uppercase">Blue:</span>
                            <span className="text-[10px] text-zinc-500 font-medium">Heavier weight than average.</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-3 bg-purple-500 rounded-full" />
                            <span className="text-[10px] text-zinc-400 font-bold uppercase">Purple:</span>
                            <span className="text-[10px] text-zinc-500 font-medium">Higher item density per box.</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-zinc-400">
                        <div className="p-1.5 bg-zinc-800/50 rounded-lg">
                            <Trophy className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Performance</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                        <span className="text-zinc-300 font-bold">Raw:</span> Your base speed in Lines Per Hour.<br />
                        <span className="text-zinc-300 font-bold text-blue-400">Adjusted:</span> Final score boosted for hard physical labor.
                    </p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-zinc-400">
                        <div className="p-1.5 bg-amber-500/10 rounded-lg">
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Effort Boost</span>
                    </div>
                    <div className="p-2 bg-zinc-800/20 rounded-xl border border-zinc-800/40">
                        <p className="text-[10px] text-zinc-500 italic font-medium">
                            Pickers lifting heavy weights or complex loads get a multiplier to their final performance score.
                        </p>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
);

export default function PickingMonitor({ title, type }: { title: any, type: any }) {
    const [data, setData] = useState<{ daily: any[], hourly: any[] }>({ daily: [], hourly: [] });
    const [thresholds, setThresholds] = useState<any>(null);
    const [blacklist, setBlacklist] = useState<string[]>([]);
    const [userMappings, setUserMappings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const [activeFlow, setActiveFlow] = useState('A-flow');
    const [selectedFloors, setSelectedFloors] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [lastRefreshed, setLastRefreshed] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'LINES_PICKED', direction: 'desc' });
    const [selectedUser, setSelectedUser] = useState<string | null>(null); // format: "QNAME__FLOOR"

    const fetchData = async () => {
        try {
            const [res, threshRes, userRes] = await Promise.all([
                fetch(`/api/dashboard-data?type=${type}`),
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

                // Auto-select all available floors 
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

    const handleExportCSV = () => {
        if (!filteredDaily || filteredDaily.length === 0) return;

        const headers = ["Operator", "Username", "Floor", "Flow", "Lines", "Items", "Ratio", "Effort (h)", "Weight Intensity", "Item Intensity", "Performance", "Adjusted Performance"];

        const rows = filteredDaily.map(row => [
            userMappings[row.QNAME] || row.QNAME,
            row.QNAME,
            row.FLOOR.replace(/_/g, ' '),
            row.FLOW,
            row.LINES_PICKED,
            row.ITEMS_PICKED,
            row.RATIO,
            row.EFFORT,
            row.WEIGHT_INTENSITY,
            row.ITEM_INTENSITY,
            row.PRODUCTIVITY,
            row.ADJUSTED_PRODUCTIVITY
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Picking_Monitor_${type}_${activeFlow}_${format(new Date(), "yyyy-MM-dd")}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportUserCSV = (user: any) => {
        const userHourly = data.hourly
            .filter((row: any) =>
                row.QNAME === user.QNAME &&
                row.FLOW === activeFlow &&
                selectedFloors.includes(row.FLOOR)
            )
            .sort((a, b) => a.HOUR - b.HOUR);

        if (userHourly.length === 0) return;

        const headers = ["Hour", "Operator", "Username", "Floor", "Flow", "Lines", "Items", "Ratio", "Effort (h)", "Weight Intensity", "Item Intensity", "Performance", "Adjusted Performance"];

        const rows = userHourly.map(row => {
            const prod = parseFloat(row.PRODUCTIVITY) || 0;
            const wIntensity = parseFloat(row.WEIGHT_INTENSITY) || 1;
            const iIntensity = parseFloat(row.ITEM_INTENSITY) || 1;
            return [
                `${String(row.HOUR).padStart(2, '0')}:00`,
                userMappings[row.QNAME] || row.QNAME,
                row.QNAME,
                row.FLOOR.replace(/_/g, ' '),
                row.FLOW,
                row.LINES_PICKED,
                row.ITEMS_PICKED,
                row.RATIO,
                row.EFFORT,
                wIntensity,
                iIntensity,
                prod,
                Math.round(prod * ((wIntensity + iIntensity) / 2))
            ];
        });

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Picking_Monitor_${type}_${user.QNAME}_${format(new Date(), "yyyy-MM-dd")}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredDaily = useMemo(() => {
        // 1. Basic filtering
        let filtered = data.daily.filter((row: any) =>
            row.FLOW === activeFlow &&
            selectedFloors.includes(row.FLOOR) &&
            !blacklist.includes(row.QNAME) &&
            (row.QNAME?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (userMappings[row.QNAME]?.toLowerCase().includes(searchQuery.toLowerCase()) || false))
        );

        // 2. Map and pre-calculate scores for sorting
        let processed = filtered.map(row => {
            const prod = parseFloat(row.PRODUCTIVITY) || 0;
            const wIntensity = parseFloat(row.WEIGHT_INTENSITY) || 1;
            const iIntensity = parseFloat(row.ITEM_INTENSITY) || 1;
            return {
                ...row,
                PRODUCTIVITY: prod,
                RATIO: parseFloat(row.RATIO) || 0,
                EFFORT: parseFloat(row.EFFORT) || 0,
                LINES_PICKED: parseInt(row.LINES_PICKED) || 0,
                ITEMS_PICKED: parseInt(row.ITEMS_PICKED) || 0,
                WEIGHT_INTENSITY: wIntensity,
                ITEM_INTENSITY: iIntensity,
                ADJUSTED_PRODUCTIVITY: Math.round(prod * ((wIntensity + iIntensity) / 2))
            };
        });

        // 3. Sorting
        if (sortConfig) {
            processed.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                if (sortConfig.direction === 'asc') return (aVal > bVal ? 1 : -1);
                return (aVal < bVal ? 1 : -1);
            });
        }

        return processed;
    }, [data.daily, activeFlow, selectedFloors, searchQuery, blacklist, userMappings, sortConfig]);

    const chartData = useMemo(() => {
        const hourlyFiltered = data.hourly.filter((row: any) =>
            row.FLOW === activeFlow && selectedFloors.includes(row.FLOOR) && !blacklist.includes(row.QNAME)
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
    }, [data.hourly, activeFlow, selectedFloors, blacklist]);

    const userHourlyData = useMemo(() => {
        if (!selectedUser) return [];
        const [selectedQname, selectedFloor] = selectedUser.split('__');
        return data.hourly
            .filter((row: any) =>
                row.QNAME === selectedQname &&
                row.FLOOR === selectedFloor &&
                row.FLOW === activeFlow
            )
            .map(row => {
                const prod = parseFloat(row.PRODUCTIVITY) || 0;
                const wIntensity = parseFloat(row.WEIGHT_INTENSITY) || 1;
                const iIntensity = parseFloat(row.ITEM_INTENSITY) || 1;
                return {
                    ...row,
                    PRODUCTIVITY: prod,
                    RATIO: parseFloat(row.RATIO) || 0,
                    EFFORT: parseFloat(row.EFFORT) || 0,
                    LINES_PICKED: parseInt(row.LINES_PICKED) || 0,
                    ITEMS_PICKED: parseInt(row.ITEMS_PICKED) || 0,
                    WEIGHT_INTENSITY: wIntensity,
                    ITEM_INTENSITY: iIntensity,
                    ADJUSTED_PRODUCTIVITY: Math.round(prod * ((wIntensity + iIntensity) / 2))
                };
            })
            .sort((a: any, b: any) => a.HOUR - b.HOUR);
    }, [data.hourly, selectedUser, activeFlow]);

    const activityMetrics = useMemo(() => {
        const now = new Date();
        const currentHour = now.getHours();
        const lastHour = currentHour === 0 ? 23 : currentHour - 1;

        const statusMap: Record<string, 'Active' | 'Idle' | 'Away'> = {};
        const activeToday = new Set<string>();

        // Filter hourly data for current context (flow/floors/blacklist)
        const relevantHourly = data.hourly.filter((row: any) =>
            row.FLOW === activeFlow &&
            selectedFloors.includes(row.FLOOR) &&
            !blacklist.includes(row.QNAME)
        );

        // Group by user to find their latest activity hour
        const userLastHour: Record<string, number> = {};
        relevantHourly.forEach((row: any) => {
            if (row.LINES_PICKED > 0) {
                if (userLastHour[row.QNAME] === undefined || row.HOUR > userLastHour[row.QNAME]) {
                    userLastHour[row.QNAME] = row.HOUR;
                }
            }
        });

        // Determine status for each user in the daily list
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
    }, [data.hourly, filteredDaily, activeFlow, selectedFloors, blacklist]);

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

    const getThresholdsForUser = (floor?: string) => {
        const flowKey = `${type}_${activeFlow.charAt(0)}`;
        // Try floor-specific first (e.g., cvns_A_ground_floor), then fallback to general (e.g., cvns_A)
        const specificKey = floor ? `${flowKey}_${floor}` : flowKey;
        return thresholds?.[specificKey] || thresholds?.[flowKey] || { emerald: 100, blue: 60, orange: 40, red: 0 };
    };

    const getPerformanceBg = (score: number, floor?: string) => {
        // Only show colors for CVNS B-flow and MS (both flows)
        const isCVNSB = type === 'cvns' && activeFlow === 'B-flow';
        const isMS = type === 'ms';

        if (!isCVNSB && !isMS) return "bg-zinc-800/30 text-zinc-300 border border-zinc-700/50";

        const thresh = getThresholdsForUser(floor);
        if (score >= thresh.emerald) return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
        if (score >= thresh.blue) return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
        if (score >= thresh.orange) return "bg-orange-500/10 text-orange-400 border border-orange-500/20";
        return "bg-red-500/10 text-red-500 border border-red-500/20";
    };

    const getPerformanceText = (score: number, floor?: string) => {
        // Only show colors for CVNS B-flow and MS (both flows)
        const isCVNSB = type === 'cvns' && activeFlow === 'B-flow';
        const isMS = type === 'ms';

        if (!isCVNSB && !isMS) return "text-zinc-300";

        const thresh = getThresholdsForUser(floor);
        if (score >= thresh.emerald) return "text-emerald-400";
        if (score >= thresh.blue) return "text-blue-500";
        if (score >= thresh.orange) return "text-orange-400";
        return "text-red-500";
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-8 font-sans selection:bg-white/10 selection:text-white">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-4 border-b border-zinc-900/50">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                <Activity className="w-6 h-6 text-emerald-500" />
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                                {title}
                            </h1>
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
                        <p className="text-sm text-zinc-400 font-medium">
                            Real-time picking analytics and performance metrics
                        </p>
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

                {/* Chart Section */}
                <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden">
                    <CardHeader className="pb-4 border-b border-zinc-800/40 bg-zinc-900/10">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-base text-zinc-200">Hourly Performance</CardTitle>
                                <CardDescription className="text-zinc-500">Bars represent total lines picked per hour, while the white line tracks active personnel.</CardDescription>
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
                                            fill="#2563eb"
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

                <MetricsLegend />

                {/* Filters Section */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="relative flex-1 min-w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                            <Input
                                placeholder="Search by operator name or username..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-zinc-900 border-zinc-800 focus-visible:ring-blue-500/50 pl-10 rounded-xl"
                            />
                        </div>
                        <Button
                            onClick={handleExportCSV}
                            variant="outline"
                            className="gap-2 bg-emerald-600/10 border-emerald-600/20 text-emerald-500 hover:bg-emerald-600 hover:text-white transition-all rounded-xl border font-semibold"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600/10 border border-blue-600/20 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.05)]">
                            <Users className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">
                                {activityMetrics.activeThisHour} Personnel Active
                            </span>
                        </div>
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
                                <TableHead onClick={() => handleSort('LINES_PICKED')} className="py-4 text-center text-xs font-semibold tracking-wider text-zinc-400 uppercase cursor-pointer hover:text-blue-500 transition-colors">
                                    <div className="flex items-center justify-center gap-1.5">
                                        Activity {sortConfig?.key === 'LINES_PICKED' && (sortConfig.direction === 'asc' ? '↓' : '↑')}
                                    </div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('RATIO')} className="py-4 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase cursor-pointer hover:text-blue-500 transition-colors">
                                    Ratio {sortConfig?.key === 'RATIO' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                                </TableHead>
                                <TableHead onClick={() => handleSort('EFFORT')} className="py-4 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase cursor-pointer hover:text-blue-500 transition-colors">
                                    Effort {sortConfig?.key === 'EFFORT' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </TableHead>
                                <TableHead className="py-4 text-center text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                    Intensity
                                </TableHead>
                                <TableHead onClick={() => handleSort('PRODUCTIVITY')} className="py-4 text-left text-xs font-semibold tracking-wider text-zinc-400 uppercase cursor-pointer hover:text-blue-500 transition-colors w-32">
                                    <div className="ml-4">
                                        Performance {sortConfig?.key === 'PRODUCTIVITY' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('ADJUSTED_PRODUCTIVITY')} className="py-4 pr-6 text-left text-xs font-semibold tracking-wider text-zinc-400 uppercase cursor-pointer hover:text-blue-500 transition-colors w-32">
                                    <div className="ml-4">
                                        Adjusted {sortConfig?.key === 'ADJUSTED_PRODUCTIVITY' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                                    </div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <AnimatePresence mode="popLayout">
                                {filteredDaily.length > 0 ? (
                                    filteredDaily.map((row: any, idx: number) => (
                                        <Fragment key={`${row.QNAME}-${row.FLOOR}-${idx}`}>
                                            <motion.tr
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className={cn(
                                                    "group cursor-pointer border-b border-zinc-800/20 transition-colors",
                                                    selectedUser === `${row.QNAME}__${row.FLOOR}` ? "bg-white/5" : "hover:bg-zinc-800/30"
                                                )}
                                                onClick={() => { const key = `${row.QNAME}__${row.FLOOR}`; setSelectedUser(selectedUser === key ? null : key); }}
                                            >
                                                <TableCell className="py-4 pl-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative">
                                                            <div className={cn(
                                                                "p-2 rounded-xl border transition-all duration-300",
                                                                selectedUser === `${row.QNAME}__${row.FLOOR}` ? "bg-blue-500/20 border-blue-500/50 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.2)]" : "bg-zinc-900/50 border-zinc-800 group-hover:border-zinc-700"
                                                            )}>
                                                                <User className={cn(
                                                                    "w-4 h-4 transition-colors",
                                                                    selectedUser === `${row.QNAME}__${row.FLOOR}` ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-400"
                                                                )} />
                                                            </div>
                                                            <div className={cn(
                                                                "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#09090b] shadow-sm flex items-center justify-center",
                                                                activityMetrics.statusMap[row.QNAME] === 'Active' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" :
                                                                    activityMetrics.statusMap[row.QNAME] === 'Idle' ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : "bg-zinc-500"
                                                            )}>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold tracking-tight text-zinc-100 uppercase">
                                                                    {userMappings[row.QNAME] || row.QNAME}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                                                    <Layers className="w-2.5 h-2.5" />
                                                                    {row.FLOOR.replace(/_/g, ' ')}
                                                                </span>
                                                                <span className="w-1 h-1 bg-zinc-800 rounded-full"></span>
                                                                <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-tight">{row.QNAME}</span>
                                                            </div>
                                                        </div>
                                                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {selectedUser === `${row.QNAME}__${row.FLOOR}` ? (
                                                                <ChevronDown className="w-4 h-4 text-blue-400" />
                                                            ) : (
                                                                <ChevronRight className="w-4 h-4 text-zinc-600" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4">
                                                    <div className="flex flex-col items-center justify-center gap-1">
                                                        <span className="text-sm font-medium text-zinc-200 tabular-nums">
                                                            {row.LINES_PICKED} <span className="text-[10px] text-zinc-500 uppercase ml-0.5 font-bold">LINES</span>
                                                        </span>
                                                        <div className="w-8 h-px bg-zinc-800/50"></div>
                                                        <span className="text-xs font-medium text-zinc-400 tabular-nums">
                                                            {row.ITEMS_PICKED} <span className="text-[9px] uppercase font-bold">UNITS</span>
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
                                                <TableCell className="py-4">
                                                    <div className="flex items-center justify-center gap-3">
                                                        <div className="flex flex-col items-center">
                                                            <span className={cn(
                                                                "text-xs font-bold tabular-nums",
                                                                row.WEIGHT_INTENSITY > 1.2 ? "text-blue-400" : row.WEIGHT_INTENSITY < 0.8 ? "text-zinc-600" : "text-zinc-400"
                                                            )}>
                                                                {row.WEIGHT_INTENSITY}x
                                                            </span>
                                                            <span className="text-[8px] text-zinc-600 uppercase font-black tracking-tighter">Weight</span>
                                                        </div>
                                                        <div className="w-px h-6 bg-zinc-800/50"></div>
                                                        <div className="flex flex-col items-center">
                                                            <span className={cn(
                                                                "text-xs font-bold tabular-nums",
                                                                row.ITEM_INTENSITY > 1.2 ? "text-purple-400" : row.ITEM_INTENSITY < 0.8 ? "text-zinc-600" : "text-zinc-400"
                                                            )}>
                                                                {row.ITEM_INTENSITY}x
                                                            </span>
                                                            <span className="text-[8px] text-zinc-600 uppercase font-black tracking-tighter">Items</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4">
                                                    <div className="flex justify-start ml-4">
                                                        <span className={cn(
                                                            "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tabular-nums shadow-sm",
                                                            getPerformanceBg(row.PRODUCTIVITY, row.FLOOR)
                                                        )}>
                                                            {row.PRODUCTIVITY}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 pr-6">
                                                    <div className="flex items-center justify-start gap-1.5 ml-4">
                                                        <span className={cn(
                                                            "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tabular-nums shadow-sm min-w-[2.5rem] justify-center",
                                                            getPerformanceBg(row.ADJUSTED_PRODUCTIVITY, row.FLOOR)
                                                        )}>
                                                            {row.ADJUSTED_PRODUCTIVITY}
                                                        </span>
                                                        {row.ADJUSTED_PRODUCTIVITY > row.PRODUCTIVITY && (
                                                            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20 animate-pulse" />
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </motion.tr>

                                            <AnimatePresence>
                                                {selectedUser === `${row.QNAME}__${row.FLOOR}` && (
                                                    <motion.tr
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="bg-white/[0.02]"
                                                    >
                                                        <TableCell colSpan={7} className="p-0 border-b border-zinc-800/40 overflow-hidden">
                                                            <div className="py-6 px-12 space-y-4">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <Button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleExportUserCSV(row);
                                                                        }}
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="gap-2 bg-emerald-600/10 border-emerald-600/20 text-emerald-500 hover:bg-emerald-600 hover:text-white transition-all rounded-lg border text-[10px] font-bold uppercase tracking-wider h-8"
                                                                    >
                                                                        <Download className="w-3.5 h-3.5" />
                                                                        Export CSV
                                                                    </Button>
                                                                </div>

                                                                <div className="grid grid-cols-7 gap-4 px-6 py-2 border-b border-zinc-800/40 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                                                    <span className="col-span-1">Interval</span>
                                                                    <span className="text-center">Activity</span>
                                                                    <span className="text-right">Ratio</span>
                                                                    <span className="text-right">Effort</span>
                                                                    <span className="text-center">Intensity</span>
                                                                    <span className="text-right ml-4">PERFORMANCE</span>
                                                                    <span className="text-left ml-4">ADJUSTED</span>
                                                                </div>

                                                                <div className="space-y-1">
                                                                    {userHourlyData.length > 0 ? (
                                                                        userHourlyData.map((hourRow: any, hIdx: number) => (
                                                                            <motion.div
                                                                                initial={{ opacity: 0, x: -10 }}
                                                                                animate={{ opacity: 1, x: 0 }}
                                                                                transition={{ delay: hIdx * 0.03 }}
                                                                                key={hIdx}
                                                                                className="grid grid-cols-7 gap-4 items-center py-2 px-6 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-zinc-800/50 transition-all group/hr"
                                                                            >
                                                                                <div className="col-span-1">
                                                                                    <span className="text-xs font-mono font-bold text-zinc-400 group-hover/hr:text-blue-400 transition-colors">
                                                                                        {String(hourRow.HOUR).padStart(2, '0')}:00
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex flex-col items-center">
                                                                                    <span className="text-[11px] font-medium text-zinc-300 tabular-nums">
                                                                                        {hourRow.LINES_PICKED} <span className="text-[9px] text-zinc-600 font-bold">LINES</span>
                                                                                    </span>
                                                                                    <span className="text-[9px] text-zinc-600 tabular-nums">
                                                                                        {hourRow.ITEMS_PICKED} <span className="text-[8px] font-bold">UNITS</span>
                                                                                    </span>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950/50 px-1.5 py-0.5 rounded border border-zinc-900">
                                                                                        {hourRow.RATIO}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <span className="text-xs text-zinc-400 font-medium tabular-nums">{hourRow.EFFORT}h</span>
                                                                                </div>
                                                                                <div className="flex items-center justify-center gap-3">
                                                                                    <span className={cn(
                                                                                        "text-[10px] font-bold tabular-nums",
                                                                                        hourRow.WEIGHT_INTENSITY > 1.2 ? "text-blue-400" : "text-zinc-600"
                                                                                    )}>{hourRow.WEIGHT_INTENSITY}x</span>
                                                                                    <div className="w-px h-3 bg-zinc-800/50"></div>
                                                                                    <span className={cn(
                                                                                        "text-[10px] font-bold tabular-nums",
                                                                                        hourRow.ITEM_INTENSITY > 1.2 ? "text-purple-400" : "text-zinc-600"
                                                                                    )}>{hourRow.ITEM_INTENSITY}x</span>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <span className={cn(
                                                                                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ml-4",
                                                                                        getPerformanceBg(hourRow.PRODUCTIVITY, hourRow.FLOOR)
                                                                                    )}>{hourRow.PRODUCTIVITY}</span>
                                                                                </div>
                                                                                <div className="col-span-1 text-left flex items-center gap-1.5 ml-4">
                                                                                    <span className={cn(
                                                                                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums min-w-[2rem] justify-center",
                                                                                        getPerformanceBg(hourRow.ADJUSTED_PRODUCTIVITY, hourRow.FLOOR)
                                                                                    )}>{hourRow.ADJUSTED_PRODUCTIVITY}</span>
                                                                                    {hourRow.ADJUSTED_PRODUCTIVITY > hourRow.PRODUCTIVITY && (
                                                                                        <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500/20" />
                                                                                    )}
                                                                                </div>
                                                                            </motion.div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="py-8 text-center border-2 border-dashed border-zinc-800/30 rounded-2xl bg-zinc-900/5 shadow-inner">
                                                                            <Clock className="w-6 h-6 text-zinc-800 mx-auto mb-2" />
                                                                            <p className="text-[10px] font-black uppercase tracking-tighter text-zinc-700">No shift data detected for this hour</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </motion.tr>
                                                )}
                                            </AnimatePresence>
                                        </Fragment>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-40 text-center border-none">
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

            </div>
        </div>
    );
}
