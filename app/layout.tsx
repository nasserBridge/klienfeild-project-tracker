import type { Metadata } from "next";
import "../styles/globals.css";
import { Sidebar } from "@/components/sidebar/Sidebar";

export const metadata: Metadata = {
  title: "Project Tracker",
  description: "Hours and budget tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 flex flex-col">{children}</main>
        </div>
      </body>
    </html>
  );
}
