'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, DoorOpen, Users, Building2,
  Sparkles, Receipt, UserCircle, Settings, ChevronLeft,
  ChevronDown, Sun, Moon, Monitor, BarChart3
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useTheme } from '@/hooks/use-theme';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  {
    label: 'Front Desk', href: '#', icon: <DoorOpen className="h-5 w-5" />,
    children: [
      { label: 'Reservations', href: '/dashboard/reservations' },
      { label: 'Check-In / Out', href: '/dashboard/reservations?tab=in-house' },
    ],
  },
  {
    label: 'Rooms', href: '#', icon: <Building2 className="h-5 w-5" />,
    children: [
      { label: 'All Rooms', href: '/dashboard/rooms' },
      { label: 'Room Types', href: '/dashboard/room-types' },
    ],
  },
  {
    label: 'Guests', href: '#', icon: <Users className="h-5 w-5" />,
    children: [
      { label: 'All Guests', href: '/dashboard/guests' },
      { label: 'History', href: '/dashboard/guests/history' },
      { label: 'Records', href: '/dashboard/guests/management' },
    ],
  },
  {
    label: 'Operations', href: '#', icon: <Sparkles className="h-5 w-5" />,
    children: [
      { label: 'Housekeeping', href: '/dashboard/housekeeping' },
      { label: 'Maintenance', href: '/dashboard/maintenance' },
    ],
  },
  {
    label: 'Billing', href: '#', icon: <Receipt className="h-5 w-5" />,
    children: [
      { label: 'All Bills', href: '/dashboard/billing' },
      { label: 'Invoices', href: '/dashboard/billing/invoices' },
    ],
  },
  { label: 'Analytics', href: '/dashboard/analytics', icon: <BarChart3 className="h-5 w-5" /> },
  { label: 'Employees', href: '/dashboard/employees', icon: <UserCircle className="h-5 w-5" /> },
  { label: 'Settings', href: '/dashboard/settings', icon: <Settings className="h-5 w-5" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const { theme, setTheme } = useTheme();

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (href: string) => {
    if (href === '#') return false;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isGroupActive = (item: NavItem) => {
    if (!item.children) return isActive(item.href);
    return item.children.some((child) => isActive(child.href));
  };

  return (
    <aside className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-[var(--bg-sidebar)] transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`} style={{ borderColor: 'var(--border)' }}>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-4" style={{ borderColor: 'var(--border)' }}>
        <Logo size="sm" iconOnly />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-[var(--text-primary)]">InnSight</span>
            <span className="text-[9px] font-medium tracking-wider text-[var(--text-muted)] uppercase">Hotel Management</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const active = isGroupActive(item);
          const expanded = expandedGroups[item.label];

          if (item.children) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active ? 'bg-brand-500/10 text-brand-400' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  {item.icon}
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`} />
                    </>
                  )}
                </button>
                {!collapsed && expanded && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                          isActive(child.href)
                            ? 'bg-brand-500/10 text-brand-400'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-500/10 text-brand-400'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {item.icon}
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-2 space-y-1" style={{ borderColor: 'var(--border)' }}>
        {!collapsed && (
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title={`Theme: ${theme}`}
          >
            {theme === 'system' ? <Monitor className="h-4 w-4" /> : theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{theme === 'system' ? 'System' : theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <ChevronLeft className={`h-5 w-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </aside>
  );
}
