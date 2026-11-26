import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Institutional access" };

export default function EntryLayout({ children }: { children: ReactNode }) {
  return children;
}
