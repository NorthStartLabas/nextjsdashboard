"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ClipboardList,
    ClipboardCheck,
    Package,
    PackageCheck,
    Gauge,
    Users,
    Monitor
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
    {
        title: "CVNS Outbound",
        items: [
            { name: "Dashboard", href: "/outbound/cvns/dashboard", icon: LayoutDashboard },
            { name: "Picking", href: "/outbound/cvns/picking", icon: ClipboardList },
            { name: "Packing", href: "/outbound/cvns/packing", icon: Package },
        ],
    },
    {
        title: "MS Outbound",
        items: [
            { name: "Dashboard", href: "/outbound/ms/dashboard", icon: Gauge },
            { name: "Picking", href: "/outbound/ms/picking", icon: ClipboardCheck },
            { name: "Packing", href: "/outbound/ms/packing", icon: PackageCheck },
        ],
    },
    {
        title: "Global",
        items: [
            { name: "User Stats", href: "/user-stats", icon: Users },
        ],
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const [version, setVersion] = React.useState("V1.0.0");

    React.useEffect(() => {
        const fetchVersion = async () => {
            try {
                const res = await fetch("/api/version");
                if (res.ok) {
                    const data = await res.json();
                    setVersion(data.version || "V1.0.0");
                }
            } catch (e) { }
        };
        fetchVersion();
    }, [pathname]);

    if (pathname === "/" || pathname === "/dev") return null;

    return (
        <div className="w-60 flex flex-col h-screen border-r border-zinc-900 bg-[#09090b] shrink-0">
            {/* Header */}
            <div className="flex items-center p-6 h-20 border-b border-zinc-900 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-blue-600 rounded-lg shrink-0">
                        <Monitor className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-semibold tracking-tight text-white/90 text-sm leading-tight">
                        Medtronic General Dashboard
                    </span>
                </div>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto py-6 px-3 space-y-7 custom-scrollbar">
                {menuItems.map((group, idx) => (
                    <div key={idx} className="space-y-3">
                        <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider px-1">
                            {group.title}
                        </h3>
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const isActive = pathname === item.href;
                                const Icon = item.icon;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "relative flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all group overflow-hidden",
                                            isActive
                                                ? "bg-blue-600/10 text-blue-500 border border-blue-600/20"
                                                : "text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent"
                                        )}
                                    >
                                        {isActive && (
                                            <span className="absolute left-0 inset-y-0 w-[3px] bg-blue-500 rounded-r-full" />
                                        )}
                                        <Icon className={cn(
                                            "w-4 h-4 transition-transform group-hover:scale-110",
                                            isActive ? "text-blue-500" : "text-zinc-500"
                                        )} />
                                        <span className="text-[13px] font-semibold whitespace-nowrap">
                                            {item.name}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Version Display */}
            <div className="p-6 border-t border-zinc-900 mt-auto">
                <div className="flex items-center gap-2 text-zinc-600">
                    <span className="text-[10px] font-black tracking-widest leading-none">Version</span>
                    <span className="text-[10px] font-mono leading-none">{version}</span>
                </div>
            </div>
        </div>
    );
}
