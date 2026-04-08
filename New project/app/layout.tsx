import type { Metadata } from "next";
import { Suspense } from "react";

import "leaflet/dist/leaflet.css";
import "./globals.css";
import EmbedMode from "@/components/EmbedMode";

export const metadata: Metadata = {
  title: "Fiber DP Finder",
  description: "Pencarian jalur kabel FO & Drop Point (DP) optimal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="h-full text-slate-100 antialiased">
        <Suspense fallback={null}>
          <EmbedMode />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
