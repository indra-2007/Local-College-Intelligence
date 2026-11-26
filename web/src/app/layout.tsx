import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import DoorwayTransition from "@/components/DoorwayTransition";

export const metadata: Metadata = {
  title: { default: "C-GPT", template: "%s | C-GPT" },
  description: "Local College Intelligence at RV College of Engineering.",
};

export const viewport: Viewport = { themeColor: "#100f0d" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body style={{ margin: 0, background: "#000" }}>
    <DoorwayTransition>{children}</DoorwayTransition>
  </body></html>;
}
