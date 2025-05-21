
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
  School, // Added School icon
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
import type { UserModel, UserRole } from '@/types';

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
  { href: '/colleges', label: 'College List', icon: School }, // Added College List
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

const showUpgradeForPlans: UserModel[] = ['Free', 'Dpp', 'Full_length', 'Chapterwise'];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [currentUserFullName, setCurrentUserFullName] = useState<string>('User');
  const [currentUserModel, setCurrentUserModel] = useState<UserModel | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserAvatarFallback, setCurrentUserAvatarFallback] = useState<string>('U');
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string | null>(null);
  const [userClass, setUserClass] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userTargetYear, setUserTargetYear] = useState<string | null>(null);
  const [userReferralCode, setUserReferralCode] = useState<string | null>(null);
  const [userReferredByCode, setUserReferredByCode] = useState<string | null>(null);
  const [userReferralStats, setUserReferralStats] = useState<object | null>(null);
  const [userExpiryDate, setUserExpiryDate] = useState<string | null>(null);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const fullName = localStorage.getItem('userFullName');
      const model = localStorage.getItem('userModel') as UserModel;
      const role = localStorage.getItem('userRole') as UserRole;
      const fallback = localStorage.getItem('userAvatarFallback');
      const avatarUrl = localStorage.getItem('userAvatarUrl');
      const storedUserClass = localStorage.getItem('userClass');
      const storedUserEmail = localStorage.getItem('userEmail');
      const storedUserPhone = localStorage.getItem('userPhone');
      const storedUserTargetYear = localStorage.getItem('userTargetYear');
      const storedReferralCode = localStorage.getItem('userReferralCode');
      const storedReferredByCode = localStorage.getItem('userReferredByCode');
      const storedReferralStats = localStorage.getItem('userReferralStats');
      const storedExpiryDate = localStorage.getItem('userExpiryDate');

      if (fullName) setCurrentUserFullName(fullName);
      if (model) setCurrentUserModel(model);
      if (role) setCurrentUserRole(role);
      if (fallback) setCurrentUserAvatarFallback(fallback);
      if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined') setCurrentUserAvatarUrl(avatarUrl);
      else setCurrentUserAvatarUrl(null);

      if (storedUserClass) setUserClass(storedUserClass);
      if (storedUserEmail) setUserEmail(storedUserEmail);
      if (storedUserPhone) setUserPhone(storedUserPhone);
      if (storedUserTargetYear) setUserTargetYear(storedUserTargetYear);
      if (storedReferralCode) setUserReferralCode(storedReferralCode);
      if (storedReferredByCode) setUserReferredByCode(storedReferredByCode);
      if (storedReferralStats) {
        try {
          setUserReferralStats(JSON.parse(storedReferralStats));
        } catch (e) {
          console.error("Error parsing referral stats from localStorage", e);
        }
      }
      if (storedExpiryDate) setUserExpiryDate(storedExpiryDate);

      if (!pb.authStore.isValid) {
        router.push('/landing');
      }
    }
  }, [pathname, router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      pb.authStore.clear();
      const keysToClear = [
        'userId', 'userFullName', 'userName', 'userModel', 'userRole',
        'userAvatarFallback', 'userAvatarUrl', 'userClass', 'userEmail',
        'userPhone', 'userTargetYear', 'userReferralCode', 'userReferredByCode',
        'userReferralStats', 'userExpiryDate'
      ];
      keysToClear.forEach(key => localStorage.removeItem(key));
      document.cookie = 'pb_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0';
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
    if (pathname.startsWith('/colleges')) return 'College List';
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

  const showMainAppHeader = !pathname.startsWith('/admin-panel') && !pathname.match(/^\/dpps\/[^/]+\/[^/]+$/);


  return (
    <div className="flex min-h-screen w-full">
      { !pathname.match(/^\/dpps\/[^/]+\/[^/]+$/) && <SideBase navStructure={appSideBaseNavStructure} pathname={pathname} /> }
      <SidebarInset className="flex-1 flex flex-col">
        {showMainAppHeader && (
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 sm:gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4">
            {isMobile && <SidebarTrigger asChild><Button variant="outline" size="icon"><Menu /></Button></SidebarTrigger>}
            <div className="flex-1">
              <h1 className="text-xl font-semibold">
                {getActiveLabel()}
              </h1>
            </div>

            {currentUserModel && showUpgradeForPlans.includes(currentUserModel) && (
                <Button
                    variant="outline"
                    size="sm"
                    className="inline-flex items-center text-primary border-primary"
                    onClick={() => router.push('/upgrade')}
                >
                    <Sparkles className="mr-1 sm:mr-2 h-4 w-4" />
                    Upgrade
                </Button>
            )}
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
        <main className={`flex-1 overflow-auto ${pathname.startsWith('/admin-panel') ? 'bg-background' : (pathname.match(/^\/dpps\/[^/]+\/[^/]+$/) ? 'bg-background' : 'bg-muted/30')}`}>
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
