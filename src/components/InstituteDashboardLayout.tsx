
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation'; // usePathname added
import { Home, Users, BookOpen, UserCheck, Camera, LogOut, Building, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarInset, SidebarContent, SidebarFooter } from '@/components/ui/sidebar'; // Assuming Sidebar components exist
import Image from 'next/image';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

export default function InstituteDashboardLayout({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname(); // Get current path
  const instituteId = searchParams.get('instituteId'); // This is a simple way, ideally context/auth would provide this

  const navItems: NavItem[] = instituteId ? [
    { href: `/institute/dashboard?instituteId=${instituteId}`, label: 'Dashboard', icon: Home },
    { href: `/institute/employees?instituteId=${instituteId}`, label: 'Employees', icon: Users },
    { href: `/institute/classrooms?instituteId=${instituteId}`, label: 'Classrooms', icon: BookOpen },
    { href: `/institute/students?instituteId=${instituteId}`, label: 'Students', icon: UserCheck },
    { href: `/institute/schedule?instituteId=${instituteId}`, label: 'Schedule', icon: CalendarDays },
    { href: `/institute/attendance?instituteId=${instituteId}`, label: 'Attendance', icon: Camera },
  ] : [];
  
  // Determine if the current path matches the nav item's href
  const isActive = (href: string) => {
    // For dashboard, exact match. For others, startsWith to handle potential sub-routes.
    if (href.includes('/dashboard')) return pathname === href.split('?')[0];
    return pathname.startsWith(href.split('?')[0]);
  };


  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-4 flex flex-col items-center gap-2">
             <Link href="/" passHref className="flex items-center gap-2 text-primary font-semibold text-lg group-data-[collapsible=icon]:hidden">
                <Building className="h-7 w-7" />
                AttendEase
             </Link>
             <Link href="/" passHref className="items-center gap-2 text-primary font-semibold text-lg hidden group-data-[collapsible=icon]:flex">
                <Building className="h-7 w-7" />
             </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <Link href={item.href} passHref legacyBehavior>
                    <SidebarMenuButton isActive={isActive(item.href)} tooltip={item.label}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 mt-auto">
            <Link href="/" passHref legacyBehavior>
                <SidebarMenuButton tooltip="Logout (Back to Home)">
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                </SidebarMenuButton>
            </Link>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex-1 flex flex-col bg-secondary/30">
            <header className="p-4 border-b bg-background flex items-center justify-between sticky top-0 z-10">
                <SidebarTrigger className="md:hidden" />
                <h2 className="text-xl font-semibold text-primary">
                  {navItems.find(item => isActive(item.href))?.label || 'Institute Portal'}
                </h2>
                {/* Placeholder for user profile or other header items */}
            </header>
            <main className="flex-1 p-6 overflow-auto">
                {children}
            </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

