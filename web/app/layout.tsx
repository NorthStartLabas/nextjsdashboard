import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = localFont({
  src: "../public/fonts/Geist/Geist-VariableFont_wght.ttf",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../public/fonts/Geist_Mono/GeistMono-VariableFont_wght.ttf",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = {
  title: "Medtronic CVNS Dashboard",
  description: "Internal dashboard for monitoring script operations",
};

import { Sidebar } from "@/components/Sidebar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-[#09090b] text-zinc-100 flex overflow-hidden`}
      >
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative h-screen">
          {children}
        </main>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
