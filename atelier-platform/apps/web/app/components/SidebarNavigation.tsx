"use client";
import { createPortal } from "react-dom";
import { useEffect, useState, useId } from "react";
import { workspaceRoutes } from "./workspaceRoutes";
import {
  LayoutDashboard,
  Users,
  UserRound,
  Scissors,
  CalendarDays,
  Building2,
  Clock3,
  CalendarOff,
  Package,
  Truck,
  Boxes,
  History,
  FlaskConical,
  ShoppingBag,
  CreditCard,
  Receipt,
  Percent,
  Wallet,
  ShieldCheck,
  ChartNoAxesCombined,
  ClipboardList,
  FileCheck2,
  Star,
  Camera,
  Workflow,
  Megaphone,
  Bell,
  HeartHandshake,
  BadgePlus,
  ContactRound,
  Gift,
  UserCog,
  Plug,
  Settings2,
  Blocks,
  KeyRound,
  ScrollText,
  Globe,
  ToggleLeft,
  ServerCog,
  ChevronDown,
  Zap,
  type LucideIcon,
} from "lucide-react";
const groups: { title: string; entries: [string, LucideIcon][] }[] = [
  {
    title: "Front desk",
    entries: [
      ["Quick Work", Zap],
      ["Bookings", CalendarDays],
      ["Overview", LayoutDashboard],
      ["Analytics", ChartNoAxesCombined],
    ],
  },
  {
    title: "Customers & bookings",
    entries: [
      ["Customers", Users],
      ["Services", Scissors],
      ["Calendar", CalendarDays],
      ["Intake forms", ClipboardList],
    ],
  },
  {
    title: "Stock & supplies",
    entries: [
      ["Products", Package],
      ["Suppliers", Truck],
      ["Inventory", Boxes],
      ["Stock history", History],
      ["Product consumption", FlaskConical],
    ],
  },
  {
    title: "Team & payroll",
    entries: [
      ["Branches", Building2],
      ["Employees", UserRound],
      ["Leave", CalendarOff],
      ["Payroll", Wallet],
      ["Commissions", Percent],
    ],
  },
  {
    title: "Sales & payments",
    entries: [
      ["POS & Orders", ShoppingBag],
      ["Payments", CreditCard],
      ["Expenses", Receipt],
    ],
  },
  {
    title: "Customer growth",
    entries: [
      ["Reviews", Star],
      ["UGC", Camera],
      ["Automations", Workflow],
      ["Campaigns", Megaphone],
      ["Notifications", Bell],
      ["Loyalty", HeartHandshake],
      ["Membership plans", BadgePlus],
      ["Memberships", ContactRound],
      ["Gift cards", Gift],
    ],
  },
  {
    title: "Salon settings",
    entries: [
      ["Members", UserCog],
      ["Settings", Settings2],
      ["Roles", KeyRound],
    ],
  },
  {
    title: "Platform",
    entries: [
      ["Platform tenants", Globe],
      ["Platform features", ToggleLeft],
      ["Job monitor", ServerCog],
    ],
  },
];
export function SidebarNavigation({
  items,
  activePage,
  onNavigate,
  compact = false,
}: {
  items: any[][];
  activePage: string;
  onNavigate: (page: string) => void;
  compact?: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    "Team & payroll": true,
    "Locations & inventory": true,
    "Sales & payments": true,
    "Customer growth": true,
    "Salon settings": true,
    Platform: true,
  });
  useEffect(() => {
    const activeGroup = groups.find((group) =>
      group.entries.some(([name]) => name === activePage),
    );
    if (activeGroup)
      setCollapsed((previous) => ({ ...previous, [activeGroup.title]: false }));
  }, [activePage]);
  const [tooltip, setTooltip] = useState<{
    label: string;
    top: number;
    left: number;
  } | null>(null);
  const tooltipId = useId();
  const labelFor = (name: string) =>
    (
      ({
        "Intake forms": "Forms & responses",
        Branches: "Locations",
        Employees: "Team members",
        Leave: "Leaves",
        Overview: "Business overview",
        "POS & Orders": "Invoices & orders",
        Inventory: "Stock levels",
        "Product consumption": "Service supplies",
      }) as Record<string, string>
    )[name] || name;
  const showTooltip = (element: HTMLElement, name: string) => {
    if (!compact || !window.matchMedia("(min-width:1024px)").matches) return;
    const box = element.getBoundingClientRect();
    setTooltip({
      label: labelFor(name),
      top: Math.min(
        window.innerHeight - 40,
        Math.max(18, box.top + box.height / 2),
      ),
      left: box.right + 16,
    });
  };
  useEffect(() => setTooltip(null), [compact, activePage]);
  const visible = new Set(items.map(([name]) => name));
  return (
    <>
      <nav
        aria-label="Salon navigation"
        onKeyDown={(event) => {
          if (event.key === "Escape") setTooltip(null);
        }}
      >
        {groups.map((group) => {
          const entries = group.entries.filter(([name]) => visible.has(name));
          if (!entries.length) return null;
          const isCollapsed = !!collapsed[group.title];
          const panelId =
            "nav-" + group.title.toLowerCase().replace(/[^a-z]+/g, "-");
          return (
            <section className="nav-group" key={group.title}>
              <button
                className="nav-group-heading"
                aria-expanded={!isCollapsed}
                aria-controls={panelId}
                onClick={() =>
                  setCollapsed((previous) => ({
                    ...previous,
                    [group.title]: !isCollapsed,
                  }))
                }
              >
                {group.title}
                <ChevronDown
                  size={14}
                  className={isCollapsed ? "collapsed" : ""}
                />
              </button>
              <div id={panelId} hidden={isCollapsed}>
                {entries.map(([name, Icon]) => (
                  <a
                    href={workspaceRoutes[name]}
                    key={name}
                    className={activePage === name ? "active" : ""}
                    aria-current={activePage === name ? "page" : undefined}
                    aria-label={labelFor(name)}
                    aria-describedby={
                      tooltip?.label === labelFor(name) ? tooltipId : undefined
                    }
                    onMouseEnter={(event) =>
                      showTooltip(event.currentTarget, name)
                    }
                    onMouseLeave={() => setTooltip(null)}
                    onFocus={(event) => showTooltip(event.currentTarget, name)}
                    onBlur={() => setTooltip(null)}
                    onClick={(event) => {
                      if (
                        event.ctrlKey ||
                        event.metaKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return;
                      event.preventDefault();
                      onNavigate(name);
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className="nav-link-label">{labelFor(name)}</span>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </nav>
      {tooltip &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className="sidebar-rail-tooltip"
            style={{ top: tooltip.top, left: tooltip.left }}
          >
            {tooltip.label}
          </div>,
          document.body,
        )}
    </>
  );
}
