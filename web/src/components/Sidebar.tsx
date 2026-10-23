"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { path: "/", icon: "grid_view", label: "Dashboard" },
    { path: "/ai-assistant", icon: "chat_bubble", label: "AI Assistant" },
    { path: "/upload", icon: "folder_open", label: "Upload & Documents" },
    { path: "/chat-history", icon: "history", label: "Chat History" },
    { path: "/regulations", icon: "menu_book", label: "Academic Regulations" },
  ];

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-surface-container-low border-r border-surface-variant z-40 flex flex-col justify-between p-space-md">
      <div className="space-y-space-base">
        <div className="px-space-sm pt-space-xs">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-medium">Navigation</span>
        </div>
        <nav className="space-y-space-xs flex flex-col">
          {links.map((link) => {
            const isActive = pathname === link.path;
            return (
              <Link
                key={link.path}
                href={link.path}
                className={`flex items-center gap-space-md px-space-md py-space-sm transition-colors rounded-lg ${
                  isActive
                    ? "bg-primary-container text-on-primary font-medium shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
                <span className="font-label-md text-label-md">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-space-sm rounded-lg bg-surface-container border border-surface-variant">
        <div className="flex items-center gap-space-xs mb-space-2xs">
          <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
          <span className="font-label-sm text-label-sm font-semibold text-primary">Encrypted Session</span>
        </div>
        <p className="font-code-sm text-code-sm text-on-surface-variant leading-relaxed">
          On-premise air-gapped compute node. Queries remain institutional.
        </p>
      </div>
    </aside>
  );
}
