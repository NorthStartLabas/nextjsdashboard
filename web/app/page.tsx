"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Users,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    id: "cvns",
    title: "CVNS Outbound",
    color: "emerald",
    links: [
      { name: "Dashboard", href: "/outbound/cvns/dashboard", icon: LayoutDashboard },
      { name: "Picking", href: "/outbound/cvns/picking", icon: ClipboardList },
      { name: "Packing", href: "/outbound/cvns/packing", icon: Package },
    ]
  },
  {
    id: "ms",
    title: "MS Outbound",
    color: "blue",
    links: [
      { name: "Dashboard", href: "/outbound/ms/dashboard", icon: LayoutDashboard },
      { name: "Picking", href: "/outbound/ms/picking", icon: ClipboardList },
      { name: "Packing", href: "/outbound/ms/packing", icon: Package },
    ]
  },
  {
    id: "global",
    title: "Performance",
    color: "zinc",
    links: [
      { name: "User Stats", href: "/user-stats", icon: Users },
    ]
  }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-8 flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-3 gap-12">
        {sections.map((section, sIdx) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sIdx * 0.1 }}
            className="space-y-4"
          >
            <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider px-1">
              {section.title}
            </h2>
            <div className="flex flex-col gap-2">
              {section.links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-center gap-3 px-4 py-3 bg-zinc-900/30 border border-zinc-800/40 rounded-xl hover:bg-zinc-900/60 hover:border-zinc-700 transition-all"
                  >
                    <div className={cn(
                      "p-2 rounded-lg bg-zinc-950 border border-zinc-900 group-hover:scale-110 transition-transform",
                      section.color === 'emerald' && "text-emerald-500",
                      section.color === 'blue' && "text-blue-500",
                      section.color === 'zinc' && "text-zinc-400"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{link.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-auto text-zinc-800 group-hover:text-zinc-600 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
