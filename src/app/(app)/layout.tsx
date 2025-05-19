
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
  ShieldCheck,
  Bell,
  Sparkles, 
  HelpCircle, 
  MessageSquareQuote,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { initializeLocalStorageData } from '@/lib/mock-data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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

const administrationItems: NavItem[] = [
  { href: '/admin-panel', label: 'Admin Panel', icon: ShieldCheck },
];

const navStructure: NavItemGroup[] = [
  { label: 'Main Navigation', items: mainNavigationItems },
  { label: 'Connect & Compete', items: connectAndCompeteItems },
  { label: 'Administration', items: administrationItems },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile } = useSidebar(); 
  const [currentUserFullName, setCurrentUserFullName] = useState<string>('User');
  const [currentUserModel, setCurrentUserModel] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserAvatarFallback, setCurrentUserAvatarFallback] = useState<string>('U');
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string | null>(null);
  const [currentUserClass, setCurrentUserClass] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(null);
  const [currentUserTargetYear, setCurrentUserTargetYear] = useState<string | null>(null);
  const [currentUserReferralCode, setCurrentUserReferralCode] = useState<string | null>(null);
  const [currentUserReferredByCode, setCurrentUserReferredByCode] = useState<string | null>(null);
  const [currentUserReferralStats, setCurrentUserReferralStats] = useState<object | null>(null);
  const [currentUserExpiryDate, setCurrentUserExpiryDate] = useState<string | null>(null);


  useEffect(() => {
    initializeLocalStorageData(); 
    if (typeof window !== 'undefined') {
      const fullName = localStorage.getItem('userFullName');
      const model = localStorage.getItem('userModel');
      const role = localStorage.getItem('userRole');
      const fallback = localStorage.getItem('userAvatarFallback');
      const avatarUrl = localStorage.getItem('userAvatarUrl');
      const userClass = localStorage.getItem('userClass'); 
      const userEmail = localStorage.getItem('userEmail'); 
      const userPhone = localStorage.getItem('userPhone');
      const userTargetYear = localStorage.getItem('userTargetYear');
      const referralCode = localStorage.getItem('userReferralCode');
      const referredByCode = localStorage.getItem('userReferredByCode');
      const referralStats = localStorage.getItem('userReferralStats');
      const expiryDate = localStorage.getItem('userExpiryDate');
      
      if (fullName) setCurrentUserFullName(fullName);
      if (model) setCurrentUserModel(model);
      if (role) setCurrentUserRole(role);
      if (fallback) setCurrentUserAvatarFallback(fallback);
      if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined') setCurrentUserAvatarUrl(avatarUrl);
      else setCurrentUserAvatarUrl(null); // Ensure it's null if no valid URL

      if (userClass) setCurrentUserClass(userClass);
      if (userEmail) setCurrentUserEmail(userEmail);
      if (userPhone) setCurrentUserPhone(userPhone);
      if (userTargetYear) setCurrentUserTargetYear(userTargetYear);
      if (referralCode) setCurrentUserReferralCode(referralCode);
      if (referredByCode) setCurrentUserReferredByCode(referredByCode);
      if (referralStats) {
        try {
          setCurrentUserReferralStats(JSON.parse(referralStats));
        } catch (e) {
          console.error("Error parsing referral stats from localStorage", e);
        }
      }
      if (expiryDate) setCurrentUserExpiryDate(expiryDate);

      if (!pb.authStore.isValid) {
        router.push('/landing');
      }
    }
  }, [pathname, router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      pb.authStore.clear(); 
      localStorage.removeItem('userId');
      localStorage.removeItem('userFullName');
      localStorage.removeItem('userName'); 
      localStorage.removeItem('userModel');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userAvatarFallback');
      localStorage.removeItem('userAvatarUrl');
      localStorage.removeItem('userClass');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userPhone');
      localStorage.removeItem('userTargetYear');
      localStorage.removeItem('userReferralCode');
      localStorage.removeItem('userReferredByCode');
      localStorage.removeItem('userReferralStats');
      localStorage.removeItem('userExpiryDate');
    }
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
    if (pathname.startsWith('/dashboard')) return 'Dashboard';
    if (pathname.startsWith('/test-series')) return 'Test Series';
    if (pathname.startsWith('/dpps')) return 'DPP';
    if (pathname.startsWith('/profile')) return 'My Profile';
    if (pathname.startsWith('/settings')) return 'Settings';
    return 'EduNexus'; 
  };

  const appSideBaseNavStructure: SideBaseNavItemGroup[] = navStructure
    .map(group => {
      if (group.label === 'Administration') {
        return currentUserRole === 'Admin' ? group : null;
      }
      return group;
    })
    .filter(Boolean) as SideBaseNavItemGroup[];

  const showMainAppHeader = !pathname.startsWith('/admin-panel');


  return (
    <div className="flex min-h-screen w-full">
      <SideBase navStructure={appSideBaseNavStructure} pathname={pathname} />
      <SidebarInset className="flex-1 flex flex-col">
        {showMainAppHeader && (
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 sm:gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4">
            {isMobile && <SidebarTrigger asChild><Button variant="outline" size="icon"><Menu /></Button></SidebarTrigger>}
            <div className="flex-1">
              <h1 className="text-xl font-semibold">
                {getActiveLabel()}
              </h1>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="hidden sm:inline-flex items-center text-primary border-primary"
            >
              <Sparkles className="mr-1 sm:mr-2 h-4 w-4" /> 
              Upgrade
            </Button>
            {currentUserModel && <Badge variant="secondary" className="hidden sm:inline-flex">Plan: {currentUserModel}</Badge>}
            <Button variant="ghost" size="icon" className="rounded-full">
              <Bell className="h-5 w-5" />
              <span className="sr-only">Notifications</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUserAvatarUrl || `https://placehold.co/40x40.png?text=${currentUserAvatarFallback}`} alt={currentUserFullName} data-ai-hint="user avatar"/>
                    <AvatarFallback>{currentUserAvatarFallback}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{currentUserFullName}</p>
                    {currentUserRole && currentUserModel && (
                      <p className="text-xs leading-none text-muted-foreground">
                        {currentUserRole} - {currentUserModel} Plan
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile"> 
                    <UserCircle className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/leaderboard">
                    <Trophy className="mr-2 h-4 w-4" />
                    Leaderboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings"> 
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/support"> 
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Support
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
        )}
        <main className="flex-1 p-0 sm:px-0 sm:py-0 overflow-auto bg-muted/30">
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}

