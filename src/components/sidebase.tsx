
'use client';
import Link from 'next/link';
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
import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

// These types should match the ones used in AppLayout or a shared types definition
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
}

interface SideBaseProps {
  navStructure: NavItemGroup[];
  pathname: string;
}

export function SideBase({ navStructure, pathname }: SideBaseProps) {
  const { state: sidebarState } = useSidebar();

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
                <SidebarGroupLabel className="group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:justify-center">
                  {sidebarState === 'collapsed' ? <MoreHorizontal className="h-4 w-4" /> : group.label}
                </SidebarGroupLabel>
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
         <SidebarMenu>
          <SidebarMenuItem>
              <SidebarMenuButton tooltip="More Options">
                  <MoreHorizontal className="h-5 w-5" />
                  <span>More</span>
              </SidebarMenuButton>
          </SidebarMenuItem>
         </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
