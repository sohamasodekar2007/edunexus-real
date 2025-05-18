
'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Logo } from '@/components/icons';
import {
  LayoutDashboard,
  ListChecks,
  ClipboardList,
  Bookmark,
  Trophy,
  Menu,
  Settings,
  UserCircle,
} from 'lucide-react';
import { useEffect } from 'react';
import { initializeLocalStorageData } from '@/lib/mock-data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  matchExact?: boolean;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, matchExact: true },
  { href: '/test-series', label: 'Test Series', icon: ListChecks },
  { href: '/dpps', label: 'DPPs', icon: ClipboardList },
  { href: '/notebook', label: 'Notebook', icon: Bookmark },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isMobile } = useSidebar();

  useEffect(() => {
    initializeLocalStorageData();
  }, []);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4">
          <Link href="/dashboard" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <Logo className="h-8 w-8 text-primary" />
            <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">EduNexus</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <ScrollArea className="h-full">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href} legacyBehavior passHref>
                    <SidebarMenuButton
                      asChild
                      isActive={item.matchExact ? pathname === item.href : pathname.startsWith(item.href)}
                      tooltip={item.label}
                    >
                      <a>
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </ScrollArea>
        </SidebarContent>
        {/* Optional Sidebar Footer example
        <SidebarFooter className="p-2 border-t">
          <SidebarMenuButton tooltip="Settings">
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </SidebarMenuButton>
        </SidebarFooter>
        */}
      </Sidebar>
      <SidebarInset className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4">
          {isMobile && <SidebarTrigger asChild><Button variant="outline" size="icon"><Menu /></Button></SidebarTrigger>}
          <div className="flex-1">
            <h1 className="text-xl font-semibold">
              {navItems.find(item => item.matchExact ? pathname === item.href : pathname.startsWith(item.href))?.label || 'EduNexus'}
            </h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" data-ai-hint="user avatar"/>
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-4 sm:px-6 sm:py-0 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
