"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Box, Layers, Zap, ClipboardList, Timer, Activity,
    ArrowRight, Package, Weight, Maximize2, CheckCircle2,
    Circle, Clock, ListChecks, BarChart3, Filter, LayoutDashboard, PieChart, Layout,
    Search, Download
} from "lucide-react";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip as RechartsTooltip, Cell, ComposedChart, Line
} from "recharts";

interface MetricSet {
    lines: number;
    items: number;
    kg: number;
    vol: number;
    deliveries?: number;
    dp10_deliveries?: number;
    dp10_lines?: number;
}

interface DataPoint {
    total: MetricSet;
    picked: MetricSet;
    not_picked: MetricSet;
}

interface ClosedMetrics {
    deliveries: number;
    hus: number;
    lines: number;
    items: number;
    vol: number;
    kg: number;
}

interface HUMetricSet {
    total: number;
    picked: number;
    not_picked: number;
    avg_lines_per_hu: number;
    avg_items_per_hu: number;
}

interface DashboardData {
    open_deliveries: number;
    open_hus: number;
    hu_summary: HUMetricSet;
    closed_today?: ClosedMetrics;
    priorities: Record<string, number>;
    priority_hus: Record<string, number>;
    cutoffs: Record<string, any>;
    summary: DataPoint;
    vltyp_distribution: Record<string, DataPoint>;
    kober_distribution: Record<string, DataPoint>;
    floors?: Record<string, any>;
}

export default function BFlowDashboard({ title, type }: { title: string, type: 'ms' | 'cvns' }) {
    const [scenario, setScenario] = useState<'backlog' | 'today' | 'future'>('today');
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeFlow, setActiveFlow] = useState('B-flow');
    const [isCutoffModalOpen, setIsCutoffModalOpen] = useState(false);
    const [isLinesModalOpen, setIsLinesModalOpen] = useState(false);
    const [isHUModalOpen, setIsHUModalOpen] = useState(false);
    const [detailedLines, setDetailedLines] = useState<any[]>([]);
    const [detailedHU, setDetailedHU] = useState<any[]>([]);
    const [linesSearchQuery, setLinesSearchQuery] = useState("");
    const [linesPriorityFilter, setLinesPriorityFilter] = useState<string[]>([]);
    const [linesFloorFilter, setLinesFloorFilter] = useState<string[]>([]);
    const [linesCutoffFilter, setLinesCutoffFilter] = useState<string[]>([]);
    const [linesStatusFilter, setLinesStatusFilter] = useState<string[]>([]);
    const [huSearchQuery, setHUSearchQuery] = useState("");
    const [huPriorityFilter, setHUPriorityFilter] = useState<string[]>([]);
    const [huFloorFilter, setHUFloorFilter] = useState<string[]>([]);
    const [huCutoffFilter, setHUCutoffFilter] = useState<string[]>([]);
    const [huStatusFilter, setHUStatusFilter] = useState<string[]>([]);
    const [huGroupedFilter, setHUGroupedFilter] = useState<string[]>([]);
    const [huPickInitiatedFilter, setHUPickInitiatedFilter] = useState<string[]>([]);
    const [linesLoading, setLinesLoading] = useState(false);
    const [huLoading, setHULoading] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState("");
    const [pickingActivity, setPickingActivity] = useState({ daily: [], hourly: [] });
    const [packingActivity, setPackingActivity] = useState({ daily: [], hourly: [] });
    const [blacklist, setBlacklist] = useState<string[]>([]);

    const fetchDetailedLines = async () => {
        try {
            setLinesLoading(true);
            const res = await fetch(`/api/dashboard-lines?type=${type}&scenario=${scenario}`);
            const result = await res.json();
            if (result.success) {
                setDetailedLines(result.data);
            }
        } catch (error) {
            console.error("Error fetching detailed lines:", error);
        } finally {
            setLinesLoading(false);
        }
    };

    const fetchDetailedHU = async () => {
        try {
            setHULoading(true);
            const res = await fetch(`/api/dashboard-hu?type=${type}&scenario=${scenario}`);
            const result = await res.json();
            if (result.success) {
                setDetailedHU(result.data);
            }
        } catch (error) {
            console.error("Error fetching detailed HU:", error);
        } finally {
            setHULoading(false);
        }
    };

    const handleExportLines = () => {
        if (!detailedLines.length) return;

        const currentFiltered = filteredDetailedLinesRaw;
        const headers = ["Delivery", "Priority", "Cutoff", "Bin", "Type", "Work Area", "Qty", "Status", "Volume", "Floor"];
        const rows = currentFiltered.map(line => [
            `"${line.VBELN || ''}"`,
            `"${line.LPRIO || ''}"`,
            `"${line.WAUHR || ''}"`,
            `"${line.VLPLA || ''}"`,
            `"${line.VLTYP || ''}"`,
            `"${line.KOBER || ''}"`,
            `${line.NISTA || 0}`,
            line.QDATU ? '"Picked"' : '"Open"',
            `${line.VOLUM || 0}`,
            `"${line.FLOOR || ''}"`
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${type}_bflow_open_lines_${scenario}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportHU = () => {
        if (!filteredDetailedHU.length) return;

        const headers = ["External HU", "Delivery", "Priority", "Cutoff", "Grouped", "Group ID", "Pick Initiated", "Status", "Lns / HU", "Itm / HU", "Floor"];
        const rows = filteredDetailedHU.map(hu => [
            `"${hu.EXIDV || ''}"`,
            `"${hu.VBELN || ''}"`,
            `"${hu.LPRIO || ''}"`,
            `"${hu.WAUHR || ''}"`,
            `"${hu.GROUPED || 'NOT OK'}"`,
            `"${hu.ZEXIDVGRP || ''}"`,
            `"${hu.PICKINIUSER || ''}"`,
            hu.IS_PICKED ? '"Picked"' : '"Open"',
            hu.LINES_PER_HU || 0,
            hu.ITEMS_PER_HU || 0,
            `"${hu.FLOOR || ''}"`
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${type}_bflow_open_hus_${scenario}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredDetailedLinesRaw = useMemo(() => {
        let filtered = detailedLines;

        if (linesSearchQuery) {
            const query = linesSearchQuery.toLowerCase();
            filtered = filtered.filter(line =>
                line.VBELN?.toLowerCase().includes(query) ||
                line.VLPLA?.toLowerCase().includes(query) ||
                line.VLTYP?.toLowerCase().includes(query) ||
                line.KOBER?.toLowerCase().includes(query)
            );
        }

        if (linesPriorityFilter.length > 0) {
            filtered = filtered.filter(line => linesPriorityFilter.includes(String(line.LPRIO).replace(/^0+/, '')));
        }

        if (linesFloorFilter.length > 0) {
            filtered = filtered.filter(line => linesFloorFilter.includes(line.FLOOR));
        }

        if (linesCutoffFilter.length > 0) {
            filtered = filtered.filter(line => {
                // Normalize WAUHR to HH:MM for comparison (handles both 'HH:MM:SS' and '2026-02-26 HH:MM:SS')
                const wauhr = String(line.WAUHR || '');
                const timePart = wauhr.includes(' ') ? wauhr.split(' ')[1] : wauhr;
                return linesCutoffFilter.includes(timePart.substring(0, 5));
            });
        }

        if (linesStatusFilter.length > 0) {
            filtered = filtered.filter(line => {
                const isPicked = !!line.QDATU;
                return linesStatusFilter.includes(isPicked ? "Picked" : "Open");
            });
        }

        return filtered;
    }, [detailedLines, linesSearchQuery, linesPriorityFilter, linesFloorFilter, linesCutoffFilter, linesStatusFilter]);

    const filteredDetailedLines = useMemo(() => {
        return filteredDetailedLinesRaw.slice(0, 500);
    }, [filteredDetailedLinesRaw]);

    const filteredDetailedHU = useMemo(() => {
        let filtered = detailedHU;

        if (huSearchQuery) {
            const query = huSearchQuery.toLowerCase();
            filtered = filtered.filter(hu =>
                hu.VBELN?.toLowerCase().includes(query) ||
                hu.EXIDV?.toLowerCase().includes(query) ||
                hu.ZEXIDVGRP?.toLowerCase().includes(query) ||
                hu.PICKINIUSER?.toLowerCase().includes(query)
            );
        }

        if (huPriorityFilter.length > 0) {
            filtered = filtered.filter(hu => huPriorityFilter.includes(String(hu.LPRIO).replace(/^0+/, '')));
        }

        if (huFloorFilter.length > 0) {
            filtered = filtered.filter(hu => huFloorFilter.includes(hu.FLOOR));
        }

        if (huCutoffFilter.length > 0) {
            filtered = filtered.filter(hu => {
                const wauhr = String(hu.WAUHR || '');
                const timePart = wauhr.includes(' ') ? wauhr.split(' ')[1] : wauhr;
                return huCutoffFilter.includes(timePart.substring(0, 5));
            });
        }

        if (huStatusFilter.length > 0) {
            filtered = filtered.filter(hu => {
                const isPicked = !!hu.IS_PICKED;
                return huStatusFilter.includes(isPicked ? "Picked" : "Open");
            });
        }

        if (huGroupedFilter.length > 0) {
            filtered = filtered.filter(hu => huGroupedFilter.includes(hu.GROUPED || "NOT OK"));
        }

        if (huPickInitiatedFilter.length > 0) {
            filtered = filtered.filter(hu => {
                const hasValue = !!hu.PICKINIUSER && hu.PICKINIUSER !== 'None' && hu.PICKINIUSER !== 'null';
                if (huPickInitiatedFilter.includes("Empty") && huPickInitiatedFilter.includes("Has Value")) return true;
                if (huPickInitiatedFilter.includes("Empty")) return !hasValue;
                if (huPickInitiatedFilter.includes("Has Value")) return hasValue;
                return true;
            });
        }

        return filtered;
    }, [detailedHU, huSearchQuery, huPriorityFilter, huFloorFilter, huCutoffFilter, huStatusFilter, huGroupedFilter, huPickInitiatedFilter]);

    const displayDetailedHU = useMemo(() => {
        return filteredDetailedHU.slice(0, 500);
    }, [filteredDetailedHU]);

    const filterOptions = useMemo(() => {
        return {
            priorities: Array.from(new Set([
                ...detailedLines.map(l => String(l.LPRIO).replace(/^0+/, '')),
                ...detailedHU.map(h => String(h.LPRIO).replace(/^0+/, ''))
            ])).filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b)),
            floors: Array.from(new Set([
                ...detailedLines.map(l => l.FLOOR),
                ...detailedHU.map(h => h.FLOOR)
            ])).filter(Boolean).sort(),
            cutoffs: Array.from(new Set([
                ...detailedLines.map(l => l.WAUHR),
                ...detailedHU.map(h => h.WAUHR)
            ].filter(Boolean).map(c => {
                // Always normalize to HH:MM regardless of whether WAUHR is 'HH:MM:SS' or '2026-02-26 HH:MM:SS'
                const timePart = c.includes(' ') ? c.split(' ')[1] : c;
                return timePart.substring(0, 5);
            }))).sort(),
            statuses: ["Picked", "Open"],
            huFloors: Array.from(new Set(detailedHU.map(h => h.FLOOR))).filter(Boolean).sort(),
            grouped: ["OK", "NOT OK"]
        };
    }, [detailedLines, detailedHU]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [bflowRes, pickingRes, packingRes, usersRes] = await Promise.all([
                fetch(`/api/dashboard-bflow?type=${type}&scenario=${scenario}`),
                fetch(`/api/dashboard-data?type=${type}&activity=picking`),
                fetch(`/api/dashboard-data?type=${type}&activity=packing`),
                fetch(`/api/users`)
            ]);

            const [bflowResult, pickingResult, packingResult, usersResult] = await Promise.all([
                bflowRes.json(),
                pickingRes.json(),
                packingRes.json(),
                usersRes.json()
            ]);

            if (bflowResult.success) {
                setData(bflowResult.data);
            } else {
                setData(null);
            }

            if (pickingResult.success) setPickingActivity(pickingResult.data);
            if (packingResult.success) setPackingActivity(packingResult.data);
            setBlacklist(usersResult.blacklist || []);

            setLastRefreshed(format(new Date(), "HH:mm:ss"));
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Calculate time to next 5-minute mark
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
    }, [type, scenario]);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    const formattedCutoffs = useMemo(() => {
        if (!data?.cutoffs) return [];
        return Object.entries(data.cutoffs).map(([time, stats]) => {
            let label = time;
            if (time.includes(' ')) {
                const parts = time.split(' ');
                if (parts[1]) label = parts[1].substring(0, 5);
            } else if (time.includes(':')) {
                label = time.substring(0, 5);
            }

            // Fallback for old data format
            const s = (typeof stats === 'object' && stats !== null) ? stats : { total_lines: stats };

            return {
                label,
                ...s
            };
        }).sort((a, b) => a.label.localeCompare(b.label));
    }, [data?.cutoffs]);

    const nextCutoff = useMemo(() => {
        if (formattedCutoffs.length === 0) return null;
        const nowStr = format(new Date(), "HH:mm");
        const upcoming = formattedCutoffs.find(c => c.label >= nowStr);
        return upcoming || formattedCutoffs[0];
    }, [formattedCutoffs]);

    const priorityData = useMemo(() => {
        if (!data?.priorities) return [];
        return Object.entries(data.priorities).map(([prio, count]) => ({
            name: `Prio ${prio}`,
            value: count,
            hus: data.priority_hus?.[prio] || 0
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [data?.priorities, data?.priority_hus]);

    const sortedVltyp = useMemo(() => {
        if (!data?.vltyp_distribution) return [];
        return Object.entries(data.vltyp_distribution)
            .sort((a, b) => b[1].total.lines - a[1].total.lines);
    }, [data?.vltyp_distribution]);

    const sortedKober = useMemo(() => {
        if (!data?.kober_distribution) return [];
        return Object.entries(data.kober_distribution)
            .sort((a, b) => b[1].total.lines - a[1].total.lines);
    }, [data?.kober_distribution]);

    const pickingChartData = useMemo(() => {
        const hourlyFiltered = pickingActivity.hourly.filter((row: any) => {
            if (row.FLOW !== activeFlow) return false;
            return !blacklist.includes(row.QNAME);
        });

        const byHour: Record<number, { lines: number, users: Set<string> }> = {};
        for (let i = 0; i < 24; i++) {
            byHour[i] = { lines: 0, users: new Set() };
        }

        hourlyFiltered.forEach((row: any) => {
            if (row.HOUR >= 0 && row.HOUR < 24) {
                const hour = row.HOUR;
                byHour[hour].lines += row.LINES_PICKED;
                if (row.LINES_PICKED > 0) {
                    byHour[hour].users.add(row.QNAME);
                }
            }
        });

        return Object.entries(byHour).map(([hour, stats]) => ({
            hour: `${hour.padStart(2, '0')}:00`,
            lines: stats.lines,
            users: stats.users.size
        })).filter(d => d.lines > 0 || d.users > 0);
    }, [pickingActivity.hourly, activeFlow, blacklist]);

    const packingChartData = useMemo(() => {
        const hourlyFiltered = packingActivity.hourly.filter((row: any) => {
            if (row.FLOW !== activeFlow) return false;
            return !blacklist.includes(row.QNAME);
        });

        const byHour: Record<number, { boxes: number, users: Set<string> }> = {};
        for (let i = 0; i < 24; i++) {
            byHour[i] = { boxes: 0, users: new Set() };
        }

        hourlyFiltered.forEach((row: any) => {
            if (row.HOUR >= 0 && row.HOUR < 24) {
                const hour = row.HOUR;
                byHour[hour].boxes += row.BOXES_PACKED;
                if (row.BOXES_PACKED > 0) {
                    byHour[hour].users.add(row.QNAME);
                }
            }
        });

        return Object.entries(byHour).map(([hour, stats]) => ({
            hour: `${hour.padStart(2, '0')}:00`,
            boxes: stats.boxes,
            users: stats.users.size
        })).filter(d => d.boxes > 0 || d.users > 0);
    }, [packingActivity.hourly, activeFlow, blacklist, type]);




    const isSpecialLayout = true; // All dashboards now use the premium unified layout

    const renderClosedOverallCard = () => (
        scenario === 'today' && data?.closed_today && (
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative group w-full"
            >
                <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl border transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200 py-4 border-b border-zinc-900/50 bg-zinc-900/5 rounded-t-2xl">
                        <CardTitle className="text-sm font-medium">Closed Overall Today</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-900/50">
                                <p className="text-[10px] font-bold uppercase text-zinc-600 tracking-tight mb-1">Deliveries</p>
                                <p className="text-xl font-black text-zinc-100">{data.closed_today.deliveries.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-900/50">
                                <p className="text-[10px] font-bold uppercase text-zinc-600 tracking-tight mb-1">Handling Units</p>
                                <p className="text-xl font-black text-zinc-100">{data.closed_today.hus.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-emerald-600/5 rounded-xl border border-emerald-600/10">
                                <p className="text-[10px] font-bold uppercase text-emerald-600/60 tracking-tight mb-1">Lines</p>
                                <p className="text-xl font-black text-emerald-500">{data.closed_today.lines.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-purple-600/5 rounded-xl border border-purple-600/10">
                                <p className="text-[10px] font-bold uppercase text-purple-600/60 tracking-tight mb-1">Items</p>
                                <p className="text-xl font-black text-purple-500">{data.closed_today.items.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        )
    );

    const renderClosedWeightVolumeCard = () => (
        scenario === 'today' && data?.closed_today && (
            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-zinc-900/20 border-zinc-800/40 rounded-2xl shadow-none border">
                    <CardContent className="p-4 space-y-1 text-center">
                        <Weight className="w-3.5 h-3.5 text-zinc-500 mx-auto mb-2" />
                        <p className="text-[9px] font-bold uppercase text-zinc-500">Closed Weight (KG)</p>
                        <p className="text-sm font-bold text-zinc-200">{data.closed_today.kg.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900/20 border-zinc-800/40 rounded-2xl shadow-none border">
                    <CardContent className="p-4 space-y-1 text-center">
                        <Maximize2 className="w-3.5 h-3.5 text-zinc-500 mx-auto mb-2" />
                        <p className="text-[9px] font-bold uppercase text-zinc-500">Closed Volume (M³)</p>
                        <p className="text-sm font-bold text-zinc-200">{(data.closed_today.vol).toLocaleString(undefined, { maximumFractionDigits: 3 })}</p>
                    </CardContent>
                </Card>
            </div>
        )
    );

    const renderOpenLinesCard = () => (
        <Card
            className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl border cursor-pointer hover:bg-zinc-900/40 transition-all group"
            onClick={() => {
                fetchDetailedLines();
                setIsLinesModalOpen(true);
            }}
        >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200 py-4 border-b border-zinc-900/50 bg-zinc-900/5 rounded-t-2xl">
                <CardTitle className="text-sm font-medium">Open Lines</CardTitle>
                <PieChart className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent className="pt-6">
                <div className="text-5xl font-black text-white">{data?.summary.total.lines.toLocaleString()}</div>
                <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-zinc-500 font-medium">Total pending picking lines</p>
                    <Maximize2 className="h-3 w-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </CardContent>
        </Card>
    );

    const renderHandlingUnitsCard = () => (
        <Card
            className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl border cursor-pointer hover:bg-zinc-900/40 transition-all group"
            onClick={() => {
                fetchDetailedHU();
                setIsHUModalOpen(true);
            }}
        >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200 py-4 border-b border-zinc-900/50 bg-zinc-900/5 rounded-t-2xl">
                <CardTitle className="text-sm font-medium">Handling Units</CardTitle>
                <Box className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-5xl font-black text-white">{(data?.open_hus || 0).toLocaleString()}</div>
                        <p className="text-xs text-zinc-500 font-medium mt-1">Total pending HUs</p>
                    </div>
                </div>

                {data?.hu_summary && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-emerald-600/5 rounded-xl border border-emerald-600/10">
                                <p className="text-[10px] font-bold uppercase text-emerald-600/60 tracking-tight mb-1">Picked</p>
                                <p className="text-xl font-black text-emerald-600">{data.hu_summary.picked.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-red-600/5 rounded-xl border border-red-600/10">
                                <p className="text-[10px] font-bold uppercase text-red-600/60 tracking-tight mb-1">Remaining</p>
                                <p className="text-xl font-black text-[#ef4444]">{data.hu_summary.not_picked.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-900/50">
                                <p className="text-[10px] font-bold uppercase text-zinc-600 tracking-tight mb-1">Lines / HU</p>
                                <p className="text-xl font-black text-zinc-100">{data.hu_summary.avg_lines_per_hu}</p>
                            </div>
                            <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-900/50">
                                <p className="text-[10px] font-bold uppercase text-zinc-600 tracking-tight mb-1">Items / HU</p>
                                <p className="text-xl font-black text-zinc-100">{data.hu_summary.avg_items_per_hu}</p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    const renderDeliveriesItemsCard = () => (
        <Card className="bg-zinc-900/20 border-zinc-800/40 rounded-2xl shadow-none border">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200 py-4 border-b border-zinc-900/50 bg-zinc-900/5 rounded-t-2xl">
                <CardTitle className="text-sm font-medium">Deliveries & Items</CardTitle>
                <Layers className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="space-y-6 pt-6 flex-1">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-900/50">
                        <p className="text-[10px] font-bold uppercase text-zinc-600 tracking-tight mb-1">Open Deliveries</p>
                        <p className="text-xl font-black text-zinc-100">{data?.open_deliveries.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-900/50">
                        <p className="text-[10px] font-bold uppercase text-zinc-600 tracking-tight mb-1">Open Items</p>
                        <p className="text-xl font-black text-zinc-100">{data?.summary.total.items.toLocaleString()}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-emerald-600/5 rounded-xl border border-emerald-600/10">
                        <p className="text-[10px] font-bold uppercase text-emerald-600/60 tracking-tight mb-1">Picked Lines</p>
                        <p className="text-xl font-black text-emerald-600">{data?.summary.picked.lines.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-red-600/5 rounded-xl border border-red-600/10">
                        <p className="text-[10px] font-bold uppercase text-red-600/60 tracking-tight mb-1">Not Picked Lines</p>
                        <p className="text-xl font-black text-[#ef4444]">{((data?.summary.total.lines || 0) - (data?.summary.picked.lines || 0)).toLocaleString()}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    const renderWeightVolumeCard = () => (
        <div className="grid grid-cols-2 gap-4">
            <Card className="bg-zinc-900/20 border-zinc-800/40 rounded-2xl shadow-none border">
                <CardContent className="p-4 space-y-1 text-center">
                    <Weight className="w-3.5 h-3.5 text-emerald-500 mx-auto mb-2" />
                    <p className="text-[9px] font-bold uppercase text-zinc-500">Open Weight (KG)</p>
                    <p className="text-sm font-bold text-zinc-200">{data?.summary.total.kg.toLocaleString()}</p>
                </CardContent>
            </Card>
            <Card className="bg-zinc-900/20 border-zinc-800/40 rounded-2xl shadow-none border">
                <CardContent className="p-4 space-y-1 text-center">
                    <Maximize2 className="w-3.5 h-3.5 text-purple-500 mx-auto mb-2" />
                    <p className="text-[9px] font-bold uppercase text-zinc-500">Open Volume (M³)</p>
                    <p className="text-sm font-bold text-zinc-200">{((data?.summary.total.vol || 0) / 1000000).toLocaleString(undefined, { maximumFractionDigits: 3 })}</p>
                </CardContent>
            </Card>
        </div>
    );

    const renderPriorityCard = () => (
        <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl border flex flex-col overflow-hidden h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200 py-4 border-b border-zinc-900/50 bg-zinc-900/5 rounded-t-2xl">
                <CardTitle className="text-sm font-medium">Delivery Priorities</CardTitle>
                <ClipboardList className="h-4 w-4 text-[#ef4444]" />
            </CardHeader>
            <CardContent className={cn("pt-6 pr-4", isSpecialLayout ? "h-[300px]" : (type === 'cvns' ? "h-[260px]" : "h-[540px]"))}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priorityData} margin={{ top: 10, right: 30, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            stroke="#52525b"
                            fontSize={10}
                            fontWeight="bold"
                            tickFormatter={(v) => v.replace('Prio ', 'DP')}
                        />
                        <YAxis axisLine={false} tickLine={false} stroke="#52525b" fontSize={10} fontWeight="bold" />
                        <RechartsTooltip
                            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const d = priorityData.find(p => p.name === label);
                                    return (
                                        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                                            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                Priority Status
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-baseline gap-3">
                                                    <span className="text-xl font-black text-white">{String(label || '').replace('Prio ', 'DP')}</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5 mt-1 border-t border-zinc-900 pt-1.5">
                                                    <span className="text-xs font-bold text-zinc-400">{(payload[0]?.value as number ?? 0).toLocaleString()} Lines</span>
                                                    <span className="text-[10px] font-medium text-blue-400">{(d?.hus || 0).toLocaleString()} Handling Units</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32} fillOpacity={0.8}>
                            {priorityData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.name.includes('10') ? '#ef4444' : COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );

    const renderCutoffCard = () => (
        <Card
            className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl border flex flex-col overflow-hidden h-full cursor-pointer hover:bg-zinc-900/40 transition-all group"
            onClick={() => setIsCutoffModalOpen(true)}
        >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200 py-4 border-b border-zinc-900/50 bg-zinc-900/5 rounded-t-2xl">
                <CardTitle className="text-sm font-medium">Cutoff Times</CardTitle>
                <Timer className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent className={cn("pt-6 px-6 flex-1 flex flex-col", isSpecialLayout ? "h-[300px]" : (type === 'cvns' ? "h-[260px]" : "h-[540px]"))}>
                <div className="flex-1 flex flex-col justify-center">
                    {nextCutoff ? (
                        <div className="p-6 bg-zinc-950/40 rounded-2xl border border-zinc-900/50 hover:bg-zinc-900/30 transition-all group/item space-y-6">
                            <div className="flex items-center justify-between border-b border-zinc-900/50 pb-4">
                                <div className="flex items-center gap-3">
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    <span className="text-xl font-black text-zinc-100 tracking-wider">
                                        {nextCutoff.label}
                                    </span>
                                </div>
                                <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                    Next Cutoff
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Open Lines</p>
                                    <p className="text-2xl font-black text-white">{(nextCutoff.total_lines || 0).toLocaleString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Picked Lines</p>
                                    <p className="text-2xl font-black text-white">{(nextCutoff.picked_lines || 0).toLocaleString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Handling Units</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-2xl font-black text-white">{(nextCutoff.total_hus || 0).toLocaleString()}</p>
                                        <p className="text-[8px] font-bold text-emerald-500">({(nextCutoff.picked_hus || 0)} picked)</p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Deliveries</p>
                                    <p className="text-2xl font-black text-white">{(nextCutoff.total_deliveries || 0).toLocaleString()}</p>
                                </div>
                                <div className="col-span-2 pt-4 border-t border-zinc-900/50">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">DP10 Priority Lines</p>
                                        <p className="text-2xl font-black text-[#ef4444]">{(nextCutoff.dp10_lines || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-3 border-2 border-dashed border-zinc-900/50 rounded-2xl">
                            <Timer className="w-8 h-8 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No upcoming cutoffs</p>
                        </div>
                    )}
                </div>
                <div className="flex items-center justify-between mt-4 px-1 pb-2">
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-tight">View detailed cutoff analytics</p>
                    <Maximize2 className="h-3 w-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </CardContent>
        </Card >
    );

    const renderStorageDistribution = () => (
        <Card className="bg-zinc-900/20 border-zinc-800/40 rounded-2xl border shadow-none flex flex-col overflow-hidden h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200 py-4 border-b border-zinc-900/50 bg-zinc-900/5 rounded-t-2xl">
                <CardTitle className="text-sm font-medium">Storage Distribution</CardTitle>
                <Layout className="h-4 w-4 text-white" />
            </CardHeader>
            <CardContent className={cn("p-0 overflow-y-auto custom-scrollbar", isSpecialLayout ? "h-[300px]" : (type === 'cvns' ? "h-[260px]" : "h-[540px]"))}>
                <div className="space-y-8 p-6">
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 border-b border-zinc-900/50 pb-2 flex justify-between">
                            <span>STORAGE TYPE</span>
                        </h4>
                        <div className="space-y-4">
                            {sortedVltyp.map(([vltyp, metrics]) => (
                                <div key={vltyp} className="space-y-2.5 group">
                                    <div className="flex justify-between items-end">
                                        <span className="text-[11px] font-black text-zinc-500 group-hover:text-zinc-200 transition-colors uppercase">{vltyp}</span>
                                        <span className="text-[10px] font-mono font-bold text-zinc-700">{metrics.total.lines.toLocaleString()} lines</span>
                                    </div>
                                    <div className="h-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900/50">
                                        <div
                                            className="h-full bg-amber-500/80 group-hover:bg-blue-500 transition-all duration-300"
                                            style={{ width: `${(metrics.total.lines / (data?.summary.total.lines || 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 border-b border-zinc-900/50 pb-2">PICKING AREA</h4>
                        <div className="space-y-4">
                            {sortedKober.map(([kober, metrics]) => (
                                <div key={kober} className="space-y-2.5 group">
                                    <div className="flex justify-between items-end">
                                        <span className="text-[11px] font-black text-zinc-500 group-hover:text-zinc-200 transition-colors uppercase">{kober || 'Unknown'}</span>
                                        <span className="text-[10px] font-mono font-bold text-zinc-700">{metrics.total.lines.toLocaleString()} lines</span>
                                    </div>
                                    <div className="h-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900/50">
                                        <div
                                            className="h-full bg-amber-500/80 group-hover:bg-blue-500 transition-all duration-300"
                                            style={{ width: `${(metrics.total.lines / (data?.summary.total.lines || 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    const renderPickingChart = () => (
        <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden h-full">
            <CardHeader className="pb-4 border-b border-zinc-800/40 bg-zinc-900/10">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-sm font-bold text-zinc-200 uppercase tracking-tight">Picking Performance</CardTitle>
                        <CardDescription className="text-[11px] text-zinc-500 font-medium">
                            Bars represent lines picked per hour, white line tracks active personnel.
                        </CardDescription>
                    </div>
                    <Zap className="h-4 w-4 text-blue-500" />
                </div>
            </CardHeader>
            <CardContent className="pt-6 pb-2">
                {pickingChartData.length > 0 ? (
                    <div className={cn("w-full", isSpecialLayout ? "h-[320px]" : "h-[300px]")}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={pickingChartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                <CartesianGrid strokeDasharray="4 4" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="hour" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                <YAxis yAxisId="left" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" hide />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                                />
                                <Bar yAxisId="left" dataKey="lines" name="Lines Picked" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} fillOpacity={0.8} />
                                <Line yAxisId="right" type="monotone" dataKey="users" name="Active Users" stroke="#e4e4e7" strokeWidth={2} dot={{ r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#e4e4e7' }} activeDot={{ r: 5, strokeWidth: 0, fill: '#fff' }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center text-zinc-500 gap-3">
                        <Activity className="h-8 w-8 opacity-20" />
                        <p className="text-sm font-medium text-zinc-600 uppercase tracking-tighter">No activity data available</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    const renderConveyorChart = () => (
        <Card className="bg-zinc-900/20 border-zinc-800/40 shadow-none rounded-2xl overflow-hidden h-full">
            <CardHeader className="pb-4 border-b border-zinc-800/40 bg-zinc-900/10">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-sm font-bold text-zinc-200 uppercase tracking-tight">
                            {type === 'ms' ? 'Conveyor Activity' : 'Packing Performance'}
                        </CardTitle>
                        <CardDescription className="text-[11px] text-zinc-500 font-medium">
                            {type === 'ms'
                                ? 'Bars represent boxes processed by the conveyor system per hour.'
                                : 'Bars represent boxes packed per hour, white line tracks active personnel.'}
                        </CardDescription>
                    </div>
                    <Package className="h-4 w-4 text-emerald-500" />
                </div>
            </CardHeader>
            <CardContent className="pt-6 pb-2">
                {packingChartData.length > 0 ? (
                    <div className={cn("w-full", isSpecialLayout ? "h-[320px]" : "h-[300px]")}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={packingChartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                <CartesianGrid strokeDasharray="4 4" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="hour" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                <YAxis yAxisId="left" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" hide />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                                />
                                <Bar yAxisId="left" dataKey="boxes" name="Boxes Packed" fill={type === 'ms' ? '#10b981' : '#a855f7'} radius={[4, 4, 0, 0]} barSize={32} fillOpacity={0.8} />
                                {type !== 'ms' && (
                                    <Line yAxisId="right" type="monotone" dataKey="users" name="Active Users" stroke="#e4e4e7" strokeWidth={2} dot={{ r: 3, fill: '#09090b', strokeWidth: 2, stroke: '#e4e4e7' }} activeDot={{ r: 5, strokeWidth: 0, fill: '#fff' }} />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center text-zinc-500 gap-3">
                        <Box className="h-8 w-8 opacity-20" />
                        <p className="text-sm font-medium text-zinc-600 uppercase tracking-tighter">No activity data available</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    const renderFloorOperations = () => type === 'cvns' && data?.floors && (
        <div className="w-full">
            <Card className="bg-zinc-900/20 border-zinc-800/40 rounded-2xl border shadow-none overflow-hidden h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-zinc-200 py-4 border-b border-zinc-900/50 bg-zinc-900/5 rounded-t-2xl">
                    <CardTitle className="text-sm font-medium">Floor Operations</CardTitle>
                    <Activity className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <div className="overflow-x-auto h-[220px] overflow-y-auto custom-scrollbar">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-900/50 hover:bg-transparent bg-zinc-900/5">
                                <TableHead className="text-[8px] font-black uppercase text-zinc-600 pl-6 h-10">Floor</TableHead>
                                <TableHead className="text-[8px] font-black uppercase text-zinc-600 text-center h-10">Open Lines</TableHead>
                                <TableHead className="text-[8px] font-black uppercase text-zinc-600 text-center h-10">Picked Lines</TableHead>
                                <TableHead className="text-[8px] font-black uppercase text-zinc-600 text-center h-10">Open HUs</TableHead>
                                <TableHead className="text-[8px] font-black uppercase text-zinc-600 text-center h-10">Open Deliv.</TableHead>
                                <TableHead className="text-[8px] font-black uppercase text-zinc-600 text-center h-10">DP10 Deliv.</TableHead>
                                <TableHead className="text-[8px] font-black uppercase text-[#ef4444] text-right pr-6 h-10">DP10 Lines</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.entries(data.floors).map(([floor, metrics]: [string, any]) => (
                                <TableRow key={floor} className="border-zinc-900/20 hover:bg-zinc-900/30 transition-colors">
                                    <TableCell className="font-black text-zinc-400 uppercase text-[10px] pl-6 py-3">{floor.replace('_', ' ')}</TableCell>
                                    <TableCell className="text-center text-[11px] font-bold text-zinc-200 py-3 font-mono">{metrics.total.lines.toLocaleString()}</TableCell>
                                    <TableCell className="text-center text-[11px] font-bold text-emerald-500 py-3 font-mono">{metrics.picked.lines.toLocaleString()}</TableCell>
                                    <TableCell className="text-center text-[11px] font-bold py-3 font-mono">
                                        <div className="flex flex-col">
                                            <span className="text-white">{metrics.hu_summary?.total || 0}</span>
                                            <span className="text-[9px] text-emerald-500 font-bold">({metrics.hu_summary?.picked || 0} picked)</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center text-[11px] font-bold text-white py-3 font-mono">{(metrics.total.deliveries || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-center text-[11px] font-bold text-white py-3 font-mono">{(metrics.total.dp10_deliveries || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right pr-6 text-[11px] font-black text-[#ef4444] py-3 font-mono">{(metrics.total.dp10_lines || 0).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-8 font-sans selection:bg-white/10 selection:text-white">
            <div className="max-w-[1700px] mx-auto space-y-8">

                {/* Header Section - Standardized style */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-4 border-b border-zinc-900/50">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-500/10 rounded-xl border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                                <LayoutDashboard className="w-6 h-6 text-orange-500" />
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
                            Operational Dashboard for Outbound B-Flow
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        {/* Flow Switcher */}
                        <div className="flex p-1 bg-zinc-950/50 rounded-xl border border-zinc-800 h-11">
                            {['A-flow', 'B-flow'].map((flow) => (
                                <button
                                    key={flow}
                                    disabled={flow === 'A-flow'}
                                    className={cn(
                                        "relative px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ease-out outline-none",
                                        activeFlow === flow ? "text-white" : "text-zinc-600 cursor-not-allowed"
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

                        {/* Scenario Switcher */}
                        <div className="flex p-1 bg-zinc-950/50 rounded-xl border border-zinc-800 h-11">
                            {(['backlog', 'today', 'future'] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setScenario(s)}
                                    className={cn(
                                        "relative px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ease-out outline-none tracking-wider",
                                        scenario === s ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    {scenario === s && (
                                        <motion.div
                                            layoutId="scenarioTab"
                                            className="absolute inset-0 bg-blue-600 rounded-lg shadow-lg"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative z-10 capitalize">{s}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center text-zinc-400">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            className="w-8 h-8 border-2 border-zinc-800 border-t-white rounded-full mb-4"
                        />
                        <p className="text-sm font-medium tracking-tight">Loading Data...</p>
                    </div>
                ) : !data ? (
                    <div className="py-24 flex flex-col items-center justify-center text-zinc-500 gap-4 border border-dashed border-zinc-800/50 rounded-2xl bg-zinc-900/10">
                        <Filter className="w-12 h-12 opacity-20" />
                        <div className="text-center">
                            <p className="text-lg font-semibold text-zinc-300">No data found</p>
                            <p className="text-sm">There are no B-flow deliveries for this section.</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {isSpecialLayout ? (
                            <div className="grid grid-cols-4 gap-6 items-start">
                                {/* COLUMN 1: VERTICAL STACK */}
                                <div className="col-span-1 space-y-6">
                                    {renderClosedOverallCard()}
                                    {renderOpenLinesCard()}
                                    {renderDeliveriesItemsCard()}
                                    {renderHandlingUnitsCard()}
                                    {renderWeightVolumeCard()}
                                    {renderClosedWeightVolumeCard()}
                                </div>

                                {/* COLUMNS 2-4: TOP ROW + CHARTS */}
                                <div className="col-span-3 space-y-6">
                                    <div className="grid grid-cols-3 gap-6 items-start">
                                        {renderPriorityCard()}
                                        {renderCutoffCard()}
                                        {renderStorageDistribution()}
                                    </div>

                                    {/* Floor Operations for CVNS */}
                                    {renderFloorOperations()}

                                    <div className="w-full">
                                        {renderPickingChart()}
                                    </div>
                                    <div className="w-full">
                                        {renderConveyorChart()}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </>
                )}
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #18181b;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #27272a;
                }
            `}</style>
            {/* Modal for Expanded Cutoff View */}
            <AnimatePresence>
                {isCutoffModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsCutoffModalOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-6xl max-h-[90vh] bg-zinc-950 border border-zinc-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-zinc-900 bg-zinc-900/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                                        <Timer className="w-6 h-6 text-amber-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight">Cutoff Times Timeline</h2>
                                        <p className="text-sm text-zinc-500 font-medium">Detailed operational metrics per deadline</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsCutoffModalOpen(false)}
                                    className="p-3 hover:bg-white/5 rounded-2xl transition-all group"
                                >
                                    <ArrowRight className="w-6 h-6 text-zinc-500 group-hover:text-white" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-zinc-900/50 hover:bg-transparent bg-zinc-900/5">
                                            <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 pl-8">Cutoff</TableHead>
                                            <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Open Lines</TableHead>
                                            <TableHead className="text-[11px] font-black uppercase text-emerald-500 h-14 text-center">Picked</TableHead>
                                            <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">HUs</TableHead>
                                            <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">HU Picked</TableHead>
                                            <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Deliveries</TableHead>
                                            <TableHead className="text-[11px] font-black uppercase text-[#ef4444] h-14 text-right pr-8">DP10 Lines</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {formattedCutoffs.map((cutoff: any, i) => (
                                            <TableRow key={i} className="border-zinc-900/30 hover:bg-white/[0.02] transition-colors">
                                                <TableCell className="pl-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <Clock className="w-4 h-4 text-zinc-600" />
                                                        <span className="text-sm font-black text-zinc-200">{cutoff.label}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-mono font-bold text-sm text-zinc-100">{(cutoff.total_lines || 0).toLocaleString()}</TableCell>
                                                <TableCell className="text-center font-mono font-bold text-sm text-emerald-500">{(cutoff.picked_lines || 0).toLocaleString()}</TableCell>
                                                <TableCell className="text-center font-mono font-bold text-sm text-zinc-100">{(cutoff.total_hus || 0).toLocaleString()}</TableCell>
                                                <TableCell className="text-center font-mono font-bold text-sm text-zinc-100">{(cutoff.picked_hus || 0).toLocaleString()}</TableCell>
                                                <TableCell className="text-center font-mono font-bold text-sm text-zinc-100">{(cutoff.total_deliveries || 0).toLocaleString()}</TableCell>
                                                <TableCell className="text-right pr-8 font-mono font-black text-sm text-[#ef4444]">{(cutoff.dp10_lines || 0).toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Modal for Detailed Open Lines View */}
                {isLinesModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsLinesModalOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-7xl max-h-[90vh] bg-zinc-950 border border-zinc-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border-b border-zinc-900 bg-zinc-900/50 gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                        <ListChecks className="w-6 h-6 text-blue-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight">Open Lines Detail</h2>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm text-zinc-500 font-medium">All pending picking lines for {scenario} scenario</p>
                                            {filteredDetailedLinesRaw.length > 500 ? (
                                                <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 font-bold uppercase">
                                                    Showing top 500 of {filteredDetailedLinesRaw.length}
                                                </span>
                                            ) : (
                                                filteredDetailedLinesRaw.length > 0 && (
                                                    <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded border border-blue-500/20 font-bold uppercase">
                                                        {filteredDetailedLinesRaw.length} Lines Found
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                        <Input
                                            placeholder="Search delivery, bin..."
                                            value={linesSearchQuery}
                                            onChange={(e) => setLinesSearchQuery(e.target.value)}
                                            className="h-10 pl-9 pr-4 bg-zinc-900/50 border-zinc-800 rounded-xl text-sm focus:outline-none focus-visible:ring-blue-500/50 transition-all w-full sm:w-64"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleExportLines}
                                        disabled={!filteredDetailedLinesRaw.length}
                                        variant="outline"
                                        size="sm"
                                        className="h-10 gap-2 bg-emerald-600/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-600 hover:text-white transition-all rounded-xl font-bold"
                                    >
                                        <Download className="w-4 h-4" />
                                        Export CSV
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsLinesModalOpen(false);
                                            setLinesSearchQuery("");
                                            setLinesPriorityFilter([]);
                                            setLinesFloorFilter([]);
                                            setLinesCutoffFilter([]);
                                            setLinesStatusFilter([]);
                                        }}
                                        className="h-10 w-10 p-0 flex items-center justify-center bg-zinc-900/50 hover:bg-white/5 rounded-xl border border-zinc-800 transition-all text-zinc-500 hover:text-white"
                                    >
                                        <ArrowRight className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex flex-1 min-h-0 overflow-hidden">
                                {/* Vertical Filter Sidebar */}
                                <aside className="w-72 border-r border-zinc-900 bg-zinc-900/20 flex flex-col p-6 overflow-y-auto custom-scrollbar gap-8">
                                    <div className="flex items-center gap-3 text-zinc-400 pb-2 border-b border-zinc-800/50">
                                        <Filter className="w-3 h-3" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Active Filters</span>
                                    </div>

                                    {/* Status Section */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Processing Status</label>
                                        <div className="flex flex-col gap-2">
                                            {filterOptions.statuses.map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => setLinesStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                                                    className={cn(
                                                        "flex items-center justify-between px-4 py-3 text-[11px] font-bold uppercase rounded-xl transition-all border",
                                                        linesStatusFilter.includes(s)
                                                            ? "bg-blue-600/10 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/5"
                                                            : "bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:border-zinc-700 hover:text-white"
                                                    )}
                                                >
                                                    {s}
                                                    {linesStatusFilter.includes(s) && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Priority Section */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pick Priority</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {filterOptions.priorities.map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setLinesPriorityFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                                    className={cn(
                                                        "px-3 py-2.5 text-[11px] font-bold uppercase rounded-xl transition-all border text-center",
                                                        linesPriorityFilter.includes(p)
                                                            ? (p === '10' ? "bg-red-600/10 border-red-500 text-red-500" : "bg-zinc-600/20 border-zinc-500 text-zinc-300")
                                                            : "bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700 hover:text-white"
                                                    )}
                                                >
                                                    DP{p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Floor Section (CVNS only) */}
                                    {type === 'cvns' && filterOptions.floors.length > 0 && (
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Floor Level</label>
                                            <div className="flex flex-col gap-2">
                                                {filterOptions.floors.map(f => (
                                                    <button
                                                        key={f}
                                                        onClick={() => setLinesFloorFilter(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}
                                                        className={cn(
                                                            "px-4 py-3 text-[11px] font-bold uppercase rounded-xl transition-all border text-left",
                                                            linesFloorFilter.includes(f)
                                                                ? "bg-amber-600/10 border-amber-500 text-amber-500"
                                                                : "bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700 hover:text-white"
                                                        )}
                                                    >
                                                        {f.replace('_', ' ')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {filterOptions.cutoffs.length > 0 && (
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Cutoff Window</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {filterOptions.cutoffs.map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setLinesCutoffFilter(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                                                        className={cn(
                                                            "px-2 py-2.5 text-[10px] font-bold rounded-xl transition-all border text-center font-mono",
                                                            linesCutoffFilter.includes(c)
                                                                ? "bg-indigo-600/10 border-indigo-500 text-indigo-400"
                                                                : "bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700 hover:text-white"
                                                        )}
                                                    >
                                                        {c}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-6 border-t border-zinc-900/50">
                                        <button
                                            onClick={() => {
                                                setLinesSearchQuery("");
                                                setLinesPriorityFilter([]);
                                                setLinesFloorFilter([]);
                                                setLinesCutoffFilter([]);
                                                setLinesStatusFilter([]);
                                            }}
                                            className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px] font-black uppercase text-zinc-500 hover:text-red-500 hover:bg-red-500/5 hover:border-red-500/30 transition-all active:scale-95"
                                        >
                                            <Zap className="w-3.5 h-3.5" />
                                            Reset Filters
                                        </button>
                                    </div>
                                </aside>

                                {/* Main Table Content Section */}
                                <div className="flex-1 flex flex-col min-w-0 bg-black/20">
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        {linesLoading ? (
                                            <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4 py-20">
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                    className="w-10 h-10 border-2 border-zinc-900 border-t-blue-500 rounded-full"
                                                />
                                                <span className="text-sm font-bold uppercase tracking-widest">Loading Detail...</span>
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-900 shadow-lg">
                                                    <TableRow className="border-none hover:bg-transparent">
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 pl-8">Delivery</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Prio</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Cutoff</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Bin</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Type</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Work Area</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Qty</TableHead>
                                                        {type !== 'ms' && <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Floor</TableHead>}
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-right pr-8">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredDetailedLines.length > 0 ? (
                                                        filteredDetailedLines.map((line: any, i: number) => (
                                                            <TableRow key={i} className="border-zinc-900/30 hover:bg-white/[0.01] transition-colors border-b">
                                                                <TableCell className="pl-8 py-4 font-mono text-sm font-bold text-zinc-300">
                                                                    {line.VBELN}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <span className={cn(
                                                                        "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                                                        line.LPRIO == '10' ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-zinc-800/50 text-zinc-400 border border-zinc-700/30"
                                                                    )}>
                                                                        {line.LPRIO}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-center font-mono text-sm text-zinc-400">
                                                                    {line.WAUHR}
                                                                </TableCell>
                                                                <TableCell className="text-center font-bold text-zinc-300">
                                                                    {line.VLPLA}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <span className="text-xs font-semibold text-zinc-500">{line.VLTYP}</span>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <span className="px-2 py-1 bg-zinc-900/50 rounded-lg text-[10px] font-bold text-zinc-400 border border-zinc-800">
                                                                        {line.KOBER}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-center font-mono font-bold text-blue-400">
                                                                    {line.NISTA}
                                                                </TableCell>
                                                                {type !== 'ms' && (
                                                                    <TableCell className="text-center">
                                                                        <span className="text-[10px] uppercase font-black text-zinc-600">
                                                                            {line.FLOOR?.replace('_', ' ')}
                                                                        </span>
                                                                    </TableCell>
                                                                )}
                                                                <TableCell className="text-right pr-8 font-mono">
                                                                    {line.QDATU ? (
                                                                        <div className="flex items-center justify-end gap-1.5 text-emerald-500">
                                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                                            <span className="text-[10px] font-black uppercase">Picked</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center justify-end gap-1.5 text-zinc-500/60">
                                                                            <Circle className="w-3.5 h-3.5" />
                                                                            <span className="text-[10px] font-black uppercase">Open</span>
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell colSpan={9} className="h-64 text-center text-zinc-600 font-medium font-mono text-xs uppercase tracking-widest leading-relaxed">
                                                                {linesSearchQuery || linesPriorityFilter.length > 0 ? "No active lines match your current filters" : "All lines processed for this sector"}
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Modal for Detailed Handling Units View */}
                {isHUModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsHUModalOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-[95vw] max-h-[90vh] bg-zinc-950 border border-zinc-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border-b border-zinc-900 bg-zinc-900/50 gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                        <Box className="w-6 h-6 text-blue-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight">Handling Units Detail</h2>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm text-zinc-500 font-medium">Open units for {scenario} scenario</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                        <Input
                                            placeholder="Search HU or delivery..."
                                            value={huSearchQuery}
                                            onChange={(e) => setHUSearchQuery(e.target.value)}
                                            className="h-10 pl-9 pr-4 bg-zinc-900/50 border-zinc-800 rounded-xl text-sm w-full sm:w-64"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleExportHU}
                                        disabled={!detailedHU.length}
                                        variant="outline"
                                        size="sm"
                                        className="h-10 gap-2 bg-emerald-600/10 border-emerald-500/20 text-emerald-500 font-bold rounded-xl"
                                    >
                                        <Download className="w-4 h-4" />
                                        Export
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsHUModalOpen(false);
                                            setHUSearchQuery("");
                                            setHUPriorityFilter([]);
                                            setHUFloorFilter([]);
                                            setHUCutoffFilter([]);
                                            setHUStatusFilter([]);
                                            setHUGroupedFilter([]);
                                            setHUPickInitiatedFilter([]);
                                        }}
                                        className="h-10 w-10 p-0 flex items-center justify-center bg-zinc-900/50 rounded-xl border border-zinc-800 transition-all text-zinc-500"
                                    >
                                        <ArrowRight className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex flex-1 min-h-0 overflow-hidden">
                                {/* Vertical Filter Sidebar */}
                                <aside className="w-72 border-r border-zinc-900 bg-zinc-900/20 flex flex-col p-6 overflow-y-auto custom-scrollbar gap-8">
                                    <div className="flex items-center gap-3 text-zinc-400 pb-2 border-b border-zinc-800/50">
                                        <Filter className="w-3 h-3" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Active Filters</span>
                                    </div>

                                    {/* Status Section */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Picked Status</label>
                                        <div className="flex flex-col gap-2">
                                            {filterOptions.statuses.map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => setHUStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                                                    className={cn(
                                                        "flex items-center justify-between px-4 py-3 text-[11px] font-bold uppercase rounded-xl transition-all border",
                                                        huStatusFilter.includes(s)
                                                            ? "bg-blue-600/10 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/5"
                                                            : "bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:border-zinc-700 hover:text-white"
                                                    )}
                                                >
                                                    {s}
                                                    {huStatusFilter.includes(s) && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Grouped Section */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Group Status</label>
                                        <div className="flex flex-col gap-2">
                                            {filterOptions.grouped.map(g => (
                                                <button
                                                    key={g}
                                                    onClick={() => setHUGroupedFilter(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                                                    className={cn(
                                                        "flex items-center justify-between px-4 py-3 text-[11px] font-bold uppercase rounded-xl transition-all border",
                                                        huGroupedFilter.includes(g)
                                                            ? "bg-emerald-600/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/5"
                                                            : "bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:border-zinc-700 hover:text-white"
                                                    )}
                                                >
                                                    {g === 'OK' ? 'Grouped (OK)' : 'Not Grouped'}
                                                    {huGroupedFilter.includes(g) && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Pick Initiated Section */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pick Initiated</label>
                                        <div className="flex flex-col gap-2">
                                            {(["Has Value", "Empty"] as const).map(opt => (
                                                <button
                                                    key={opt}
                                                    onClick={() => setHUPickInitiatedFilter(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt])}
                                                    className={cn(
                                                        "flex items-center justify-between px-4 py-3 text-[11px] font-bold uppercase rounded-xl transition-all border",
                                                        huPickInitiatedFilter.includes(opt)
                                                            ? opt === 'Empty'
                                                                ? "bg-orange-600/10 border-orange-500 text-orange-400 shadow-lg shadow-orange-500/5"
                                                                : "bg-sky-600/10 border-sky-500 text-sky-400 shadow-lg shadow-sky-500/5"
                                                            : "bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:border-zinc-700 hover:text-white"
                                                    )}
                                                >
                                                    {opt === 'Empty' ? 'No user (empty)' : 'Has user'}
                                                    {huPickInitiatedFilter.includes(opt) && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Priority Section */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Priority Level</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {filterOptions.priorities.map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setHUPriorityFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                                    className={cn(
                                                        "px-3 py-2.5 text-[11px] font-bold uppercase rounded-xl transition-all border text-center",
                                                        huPriorityFilter.includes(p)
                                                            ? (p === '10' ? "bg-red-600/10 border-red-500 text-red-500" : "bg-zinc-600/20 border-zinc-500 text-zinc-300")
                                                            : "bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700 hover:text-white"
                                                    )}
                                                >
                                                    DP{p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Floor Section (CVNS only) */}
                                    {type === 'cvns' && filterOptions.huFloors.length > 0 && (
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Floor Level</label>
                                            <div className="flex flex-col gap-2">
                                                {filterOptions.huFloors.map(f => (
                                                    <button
                                                        key={f}
                                                        onClick={() => setHUFloorFilter(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}
                                                        className={cn(
                                                            "px-4 py-3 text-[11px] font-bold uppercase rounded-xl transition-all border text-left",
                                                            huFloorFilter.includes(f)
                                                                ? "bg-amber-600/10 border-amber-500 text-amber-500"
                                                                : "bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700 hover:text-white"
                                                        )}
                                                    >
                                                        {f.replace('_', ' ')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Cutoff Section */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Cutoff Window</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {filterOptions.cutoffs.map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setHUCutoffFilter(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                                                    className={cn(
                                                        "px-2 py-2.5 text-[10px] font-bold rounded-xl transition-all border text-center font-mono",
                                                        huCutoffFilter.includes(c)
                                                            ? "bg-indigo-600/10 border-indigo-500 text-indigo-400"
                                                            : "bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700 hover:text-white"
                                                    )}
                                                >
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-6 border-t border-zinc-900/50">
                                        <button
                                            onClick={() => {
                                                setHUSearchQuery("");
                                                setHUPriorityFilter([]);
                                                setHUFloorFilter([]);
                                                setHUCutoffFilter([]);
                                                setHUStatusFilter([]);
                                                setHUGroupedFilter([]);
                                                setHUPickInitiatedFilter([]);
                                            }}
                                            className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px] font-black uppercase text-zinc-500 hover:text-red-500 hover:bg-red-500/5 hover:border-red-500/30 transition-all active:scale-95"
                                        >
                                            <Zap className="w-3.5 h-3.5" />
                                            Reset Filters
                                        </button>
                                    </div>
                                </aside>

                                {/* Main Table Content Section */}
                                <div className="flex-1 flex flex-col min-w-0 bg-black/20" style={{ overflow: 'hidden' }}>
                                    <div className="flex-1" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
                                        {huLoading ? (
                                            <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4 py-20">
                                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-10 h-10 border-2 border-zinc-900 border-t-blue-500 rounded-full" />
                                                <span className="text-sm font-bold uppercase tracking-widest">Loading Detail...</span>
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-900 shadow-lg">
                                                    <TableRow className="border-none hover:bg-transparent">
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 pl-8">Handling Unit</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Delivery</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Grouped</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Group ID</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Prio</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Cutoff</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Pick Initiated</TableHead>
                                                        {type !== 'ms' && <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Floor</TableHead>}
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-center">Status</TableHead>
                                                        <TableHead className="text-[11px] font-black uppercase text-zinc-500 h-14 text-right pr-8">Lns / Itm</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {displayDetailedHU.length > 0 ? (
                                                        displayDetailedHU.map((hu: any, i: number) => (
                                                            <TableRow key={i} className="border-zinc-900/30 hover:bg-white/[0.01] transition-colors border-b">
                                                                <TableCell className="pl-8 py-4 font-mono text-sm font-black text-blue-500">{hu.EXIDV}</TableCell>
                                                                <TableCell className="text-center font-mono text-xs text-zinc-400">{hu.VBELN}</TableCell>
                                                                <TableCell className="text-center">
                                                                    {hu.GROUPED === 'OK' ? (
                                                                        <div className="flex items-center justify-center gap-1.5" title="Found in Priority Group">
                                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                                            <span className="text-[9px] font-black uppercase text-emerald-500">Grouped</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center justify-center gap-1.5" title="Not in Priority Group">
                                                                            <Circle className="w-3.5 h-3.5 text-zinc-700" />
                                                                            <span className="text-[9px] font-black uppercase text-zinc-700">—</span>
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-center font-mono text-[10px] text-zinc-500">
                                                                    {hu.ZEXIDVGRP || '-'}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase", hu.LPRIO == '10' ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/30")}>
                                                                        {hu.LPRIO}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-center font-mono text-xs text-zinc-400">
                                                                    {hu.WAUHR?.includes(' ') ? hu.WAUHR.split(' ')[1]?.substring(0, 5) : hu.WAUHR?.substring(0, 5)}
                                                                </TableCell>
                                                                <TableCell className="text-center font-mono text-[10px] text-zinc-500">
                                                                    {hu.PICKINIUSER || '-'}
                                                                </TableCell>
                                                                {type !== 'ms' && (
                                                                    <TableCell className="text-center">
                                                                        <span className="text-[10px] uppercase font-black text-zinc-600">
                                                                            {hu.FLOOR?.replace('_', ' ')}
                                                                        </span>
                                                                    </TableCell>
                                                                )}
                                                                <TableCell className="text-center">
                                                                    {hu.IS_PICKED ? (
                                                                        <span className="flex items-center justify-center gap-1.5 text-emerald-500 font-black text-[10px] uppercase">
                                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Picked
                                                                        </span>
                                                                    ) : (
                                                                        <span className="flex items-center justify-center gap-1.5 text-zinc-600 font-black text-[10px] uppercase">
                                                                            <Circle className="w-3.5 h-3.5" /> Pending
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right pr-8 font-mono text-xs font-bold text-zinc-300">
                                                                    {Math.round(hu.LINES_PER_HU)} <span className="opacity-40">/</span> {Math.round(hu.ITEMS_PER_HU)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell colSpan={10} className="h-64 text-center text-zinc-600 font-medium font-mono text-xs uppercase tracking-widest leading-relaxed">
                                                                {huSearchQuery || huPriorityFilter.length > 0 ? "No active HUs match your filters" : "All units processed for this sector"}
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
