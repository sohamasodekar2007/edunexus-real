
'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  // Sidebar, // Replaced by SideBase
  // SidebarContent, // Used within SideBase
  // SidebarHeader, // Used within SideBase
  // SidebarMenu, // Used within SideBase
  // SidebarMenuItem, // Used within SideBase
  // SidebarMenuButton, // Used within SideBase
  SidebarTrigger,
  SidebarInset,
  useSidebar,
  // SidebarFooter, // Used within SideBase
  // SidebarGroup, // Used within SideBase
  // SidebarGroupLabel, // Used within SideBase
  // SidebarSeparator, // Used within SideBase
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
// import { ScrollArea } from '@/components/ui/scroll-area'; // Used within SideBase
// import { Logo } from '@/components/icons'; // Used within SideBase
import {
  LayoutDashboard,
  ListChecks,
  ClipboardList,
  Bookmark,
  Trophy,
  Menu,
  Settings,
  UserCircle,
  LogOut,
  FileQuestion,
  ClipboardCheck,
  TrendingUp,
  Swords,
  Mail,
  Search, 
  UserCheck,
  Users,
  GitCompareArrows,
  MessageSquareQuote,
  ShieldCheck,
  // MoreHorizontal, // Used within SideBase
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
} from "@/components/ui/dropdown-menu";
import { SideBase, type NavItemGroup as SideBaseNavItemGroup, type NavItem as SideBaseNavItem } from '@/components/sidebase'; // Import the new component and types

// Ensure NavItem and NavItemGroup types used here are compatible with SideBase's props
interface NavItem extends SideBaseNavItem {}
interface NavItemGroup extends SideBaseNavItemGroup {}


const mainNavigationItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, matchExact: true },
  { href: '/test-series', label: 'Test Series', icon: ListChecks },
  { href: '/dpps', label: 'DPP', icon: ClipboardList },
  { href: '/pyq-dpps', label: 'PYQ DPPs', icon: FileQuestion },
  { href: '/pyq-mock-tests', label: 'PYQ Mock Tests', icon: ClipboardCheck },
  { href: '/notebook', label: 'Notebooks', icon: Bookmark },
  { href: '/my-progress', label: 'My Progress', icon: TrendingUp },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
];

const connectAndCompeteItems: NavItem[] = [
  { href: '/create-challenge', label: 'Create Challenge', icon: Swords },
  { href: '/challenge-invites', label: 'Challenge Invites', icon: Mail },
  { href: '/find-friends', label: 'Find Friends', icon: Search },
  { href: '/following', label: 'Following', icon: UserCheck },
  { href: '/followers', label: 'Followers', icon: Users },
  { href: '/compare', label: 'Compare', icon: GitCompareArrows },
];

const aiToolsItems: NavItem[] = [
  { href: '/doubt-solving', label: 'Doubt Solving', icon: MessageSquareQuote },
];

const administrationItems: NavItem[] = [
  { href: '/admin-panel', label: 'Admin Panel', icon: ShieldCheck },
];

const navStructure: NavItemGroup[] = [
  { label: 'Main Navigation', items: mainNavigationItems },
  { label: 'Connect & Compete', items: connectAndCompeteItems },
  { label: 'AI Tools', items: aiToolsItems },
  { label: 'Administration', items: administrationItems },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile } = useSidebar(); 

  useEffect(() => {
    initializeLocalStorageData();
  }, []);

  const handleLogout = () => {
    router.push('/landing');
  };
  
  const getActiveLabel = () => {
    for (const group of navStructure) {
      for (const item of group.items) {
        if (item.matchExact ? pathname === item.href : pathname.startsWith(item.href)) {
          return item.label;
        }
      }
    }
    return 'EduNexus'; 
  };

  // Ensure the navStructure passed to SideBase matches its expected prop type
  const appSideBaseNavStructure: SideBaseNavItemGroup[] = navStructure;

  return (
    <div className="flex min-h-screen w-full">
      <SideBase navStructure={appSideBaseNavStructure} pathname={pathname} />
      <SidebarInset className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4">
          {isMobile && <SidebarTrigger asChild><Button variant="outline" size="icon"><Menu /></Button></SidebarTrigger>}
          <div className="flex-1">
            <h1 className="text-xl font-semibold">
              {getActiveLabel()}
            </h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" data-ai-hint="user avatar"/>
                  <AvatarFallback>S</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserCircle className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-0 sm:px-0 sm:py-0 overflow-auto bg-muted/30">
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
