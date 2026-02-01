'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Library,
  Import,
  FolderOpen,
  Settings,
  ArrowRightLeft,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Library', icon: Library },
  { href: '/import', label: 'Import', icon: Import },
  { href: '/transfer-packs', label: 'Transfer', icon: ArrowRightLeft },
  { href: '/export', label: 'Export', icon: Download },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center h-16 flex-shrink-0 px-4 border-b">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">PinBridge</span>
            </Link>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:pl-64">
        <div className="py-6 px-4 md:px-8 max-w-6xl mx-auto">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background z-50">
        <div className="flex items-center justify-around h-16">
          {navItems.slice(0, 5).map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom padding for mobile nav */}
      <div className="h-16 md:hidden" />
    </div>
  );
}
