"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  AudioLines,
  LayoutDashboard,
  Gift,
  Sparkles,
  Users,
  Settings2,
  ArrowUpRight,
  Sun,
  Moon,
  ChevronDown,
  FlaskConical,
} from "lucide-react";
import { productName } from "@/lib/config";
import { Button } from "./ui/button";
const nav = [
  { href: "/demo", label: "Home", icon: LayoutDashboard },
  { href: "/demo/team", label: "Team", icon: Users },
  { href: "/demo/rewards", label: "Rewards", icon: Gift },
  { href: "/demo/ai", label: "AI", icon: Sparkles },
];
function subscribe(callback: () => void) {
  window.addEventListener("theme-change", callback);
  return () => window.removeEventListener("theme-change", callback);
}
function getTheme() {
  return document.documentElement.dataset.theme ?? "system";
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const theme = useSyncExternalStore(subscribe, getTheme, () => "system");
  function toggleTheme() {
    const dark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "light" : "dark";
    window.dispatchEvent(new Event("theme-change"));
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/demo" className="brand">
          <span className="brand-mark">
            <AudioLines size={23} />
          </span>
          {productName}
          <span className="brand-dot">.</span>
        </Link>
        <div className="workspace-switch">
          <span className="org-avatar">a</span>
          <span>
            <strong>Acme</strong>
            <small>Demo workspace</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              className={`nav-item ${path === href ? "active" : ""}`}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Content" && <span className="nav-count">8</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="build-card">
            <span className="build-icon">
              <FlaskConical size={18} />
            </span>
            <strong>
              A little preview.
              <br />A lot of possibility.
            </strong>
            <p>Explore the foundation of your team’s next chapter.</p>
            <Link href="/setup">
              Set up your live workspace <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="profile">
            <span className="avatar purple">AM</span>
            <div>
              <strong>Alex Morgan</strong>
              <small>Sample teammate</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div>
            <span className="muted">Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <span>
              {path === "/demo"
                ? "Home"
                : path === "/demo/ai"
                  ? "AI"
                  : path
                      .split("/")
                      .pop()
                      ?.replace(/^./, (c) => c.toUpperCase())}
            </span>
          </div>
          <div className="topbar-actions">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle color theme"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Link
              className="mobile-settings"
              href="/demo/settings"
              aria-label="Workspace settings"
            >
              <Settings2 size={17} />
            </Link>
            <Link href="/setup" className="demo-pill">
              <span />
              V1 preview <ArrowUpRight size={13} />
            </Link>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <span>{productName} · Made for the people behind your company.</span>
          <span>Fictional data · September 2026</span>
        </footer>
      </div>
    </div>
  );
}
