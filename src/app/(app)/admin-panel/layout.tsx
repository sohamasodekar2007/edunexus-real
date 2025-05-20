
'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert,
  ListChecks,
  ClipboardList,
  Settings2,
  Menu,
  UserCircle,
  LogOut,
  Bell,
  PlusCircle,
  Users, // Added Users icon
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SideBase, type NavItemGroup as SideBaseNavItemGroup, type NavItem as SideBaseNavItem } from '@/components/sidebase';
import pb from '@/lib/pocketbase';

interface AdminNavItem extends SideBaseNavItem {}
interface AdminNavItemGroup extends SideBaseNavItemGroup {}

const adminNavigationItems: AdminNavItem[] = [
  { href: '/admin-panel', label: 'Dashboard', icon: ShieldAlert, matchExact: true },
  { href: '/admin-panel/add-question', label: 'Add Question', icon: PlusCircle },
  { href: '/admin-panel/users', label: 'User Management', icon: Users }, // Re-added User Management
  { href: '/admin-panel/tests', label: 'Test Management', icon: ListChecks },
  { href: '/admin-panel/dpps', label: 'DPP Management', icon: ClipboardList },
  { href: '/admin-panel/site-settings', label: 'Site Settings', icon: Settings2 },
];

const adminNavStructure: AdminNavItemGroup[] = [
  { label: 'Admin Menu', items: adminNavigationItems },
];

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [currentUserFullName, setCurrentUserFullName] = useState<string>('Admin');
  const [currentUserAvatarFallback, setCurrentUserAvatarFallback] = useState<string>('A');
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('userRole');
      const fullName = localStorage.getItem('userFullName');
      const fallback = localStorage.getItem('userAvatarFallback');
      
      setCurrentUserRole(role);
      if (fullName) setCurrentUserFullName(fullName);
      if (fallback) setCurrentUserAvatarFallback(fallback);

      if (role !== 'Admin') {
        router.replace('/dashboard'); 
      } else {
        setIsLoading(false);
      }
    }
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      pb.authStore.clear();
      ['userId', 'userFullName', 'userName', 'userModel', 'userRole', 'userAvatarFallback', 'userClass', 'userEmail', 'userPhone', 'userTargetYear', 'userReferralCode', 'userReferredByCode', 'userReferralStats', 'userExpiryDate', 'userAvatarUrl'].forEach(key => localStorage.removeItem(key));
    }
    router.push('/landing');
  };

  const getActiveLabel = () => {
    for (const group of adminNavStructure) {
      for (const item of group.items) {
        if (item.matchExact ? pathname === item.href : pathname.startsWith(item.href)) {
          return item.label;
        }
      }
    }
    if (pathname === '/admin-panel') return 'Dashboard';
    if (pathname === '/admin-panel/add-question') return 'Add Question';
    if (pathname.startsWith('/admin-panel/users')) return 'User Management'; // Added for active label
    if (pathname.startsWith('/admin-panel/tests')) return 'Test Management';
    if (pathname.startsWith('/admin-panel/dpps')) return 'DPP Management';
    if (pathname.startsWith('/admin-panel/site-settings')) return 'Site Settings';
    return 'Admin Panel';
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Loading Admin Panel...</p></div>;
  }

  if (currentUserRole !== 'Admin') {
    return <div className="flex min-h-screen items-center justify-center"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="flex min-h-screen w-full">
      <SideBase navStructure={adminNavStructure} pathname={pathname} />
      <SidebarInset className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 sm:gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4">
          {isMobile && <SidebarTrigger asChild><Button variant="outline" size="icon"><Menu /></Button></SidebarTrigger>}
          <div className="flex-1">
            <h1 className="text-xl font-semibold">
              Admin Panel - {getActiveLabel()}
            </h1>
          </div>

          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://placehold.co/40x40.png?text=${currentUserAvatarFallback}`} alt={currentUserFullName} data-ai-hint="admin avatar"/>
                  <AvatarFallback>{currentUserAvatarFallback}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{currentUserFullName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {currentUserRole}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserCircle className="mr-2 h-4 w-4" />
                  My Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                <ShieldAlert className="mr-2 h-4 w-4" /> 
                Exit Admin
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 px-6 py-4 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
