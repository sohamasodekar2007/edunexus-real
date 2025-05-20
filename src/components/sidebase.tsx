
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Logo } from '@/components/icons';
import { 
  MoreHorizontal,
  CreditCard,
  Gift,
  SunMoon,
  Settings as SettingsIcon, 
  HelpCircle,
  LayoutDashboard
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType; // Lucide icon component
  matchExact?: boolean;
}

export interface NavItemGroup {
  label?: string;
  items: NavItem[];
  isCollapsible?: boolean;
  labelHref?: string; 
  labelIcon?: React.ElementType; 
}

interface SideBaseProps {
  navStructure: NavItemGroup[];
  pathname: string;
}

export function SideBase({ navStructure, pathname }: SideBaseProps) {
  const { state: sidebarState } = useSidebar();
  const router = useRouter();

  const handleToggleTheme = () => {
    console.log("Toggle theme clicked - (Implementation needed)");
    // Implement theme toggle logic here
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <Logo className="h-8 w-8 text-primary" />
          <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">EduNexus</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
          {navStructure.map((group, groupIndex) => (
            <SidebarGroup key={group.label || `group-${groupIndex}`}>
              {group.label && (
                group.labelHref ? (
                  <Link href={group.labelHref} passHref legacyBehavior>
                    <SidebarGroupLabel 
                      asChild 
                      className="cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:justify-center"
                    >
                      <a className="flex w-full items-center gap-2"> {/* Ensure 'a' tag fills and aligns content */}
                        {sidebarState === 'collapsed' && group.labelIcon ? (
                          <group.labelIcon className="h-5 w-5" /> 
                        ) : sidebarState === 'collapsed' && !group.labelIcon ? (
                           <MoreHorizontal className="h-4 w-4" /> 
                        ) : (
                          <>
                            {group.labelIcon && <group.labelIcon className="h-5 w-5" />}
                            <span>{group.label}</span>
                          </>
                        )}
                      </a>
                    </SidebarGroupLabel>
                  </Link>
                ) : (
                  <SidebarGroupLabel className="group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:justify-center">
                    {sidebarState === 'collapsed' ? <MoreHorizontal className="h-4 w-4" /> : group.label}
                  </SidebarGroupLabel>
                )
              )}
              <SidebarMenu>
                {group.items.map((item) => (
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
              {groupIndex < navStructure.length - 1 && <SidebarSeparator className="my-2"/>}
            </SidebarGroup>
          ))}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-sidebar-border">
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton tooltip="More Options" className="w-full">
                  <MoreHorizontal className="h-5 w-5" />
                  <span>More</span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-2 ml-2">
              <DropdownMenuLabel>Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/upgrade')}>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Upgrade Plan</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/referrals')}>
                <Gift className="mr-2 h-4 w-4" />
                <span>Referrals</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleToggleTheme}>
                <SunMoon className="mr-2 h-4 w-4" />
                <span>Toggle Theme</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <SettingsIcon className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/support')}>
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Help & Support</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
