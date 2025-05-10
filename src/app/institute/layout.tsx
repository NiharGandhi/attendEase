
import type { ReactNode } from 'react';
import InstituteDashboardLayout from '@/components/InstituteDashboardLayout';

export default function InstituteLayout({ children }: { children: ReactNode }) {
  return <InstituteDashboardLayout>{children}</InstituteDashboardLayout>;
}
