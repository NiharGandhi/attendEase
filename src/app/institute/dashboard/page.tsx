
"use client";
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Users, BookOpen, UserCheck, Camera } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
  href?: string;
  instituteId?: string | null;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, description, href, instituteId }) => {
  const cardContent = (
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
  );

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      {href && instituteId ? (
        <Link href={`${href}?instituteId=${instituteId}`} passHref>
          <div className="cursor-pointer">
            {cardContent}
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
          </div>
        </Link>
      ) : (
        <>
          {cardContent}
          <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </CardContent>
        </>
      )}
    </Card>
  );
};


export default function InstituteDashboardPage() {
  const searchParams = useSearchParams();
  const instituteId = searchParams.get('instituteId');
  // In a real app, fetch this data from Firestore based on instituteId
  const instituteName = "Your Institute"; // Placeholder

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Welcome to {instituteName} Dashboard</h1>
      <p className="text-muted-foreground">
        Manage your employees, classrooms, students, and attendance records efficiently.
        {instituteId && <span className="block text-sm">Institute ID: {instituteId}</span>}
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard 
            title="Total Employees" 
            value="0" 
            icon={Users} 
            description="Registered staff members"
            href="/institute/employees"
            instituteId={instituteId}
        />
        <StatCard 
            title="Total Classrooms" 
            value="0" 
            icon={BookOpen} 
            description="Available learning spaces"
            href="/institute/classrooms"
            instituteId={instituteId}
        />
        <StatCard 
            title="Total Students" 
            value="0" 
            icon={UserCheck} 
            description="Enrolled students"
            href="/institute/students"
            instituteId={instituteId}
        />
        <StatCard 
            title="Today's Attendance" 
            value="N/A" 
            icon={Camera} 
            description="Live attendance status (coming soon)"
            href="/institute/attendance"
            instituteId={instituteId}
        />
        <StatCard 
            title="Overall Attendance Rate" 
            value="N/A %" 
            icon={BarChart} 
            description="Average student presence"
        />
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Perform common tasks quickly.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {instituteId && (
            <>
            <Link href={`/institute/employees?instituteId=${instituteId}&action=add`} passHref>
                <Button variant="outline">Add New Employee</Button>
            </Link>
            <Link href={`/institute/classrooms?instituteId=${instituteId}&action=add`} passHref>
                <Button variant="outline">Add New Classroom</Button>
            </Link>
            <Link href={`/institute/students?instituteId=${instituteId}&action=add`} passHref>
                <Button variant="outline">Add New Student</Button>
            </Link>
            <Link href={`/institute/attendance?instituteId=${instituteId}`} passHref>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Start Attendance Session</Button>
            </Link>
            </>
          )}
          {!instituteId && <p className="text-destructive">Institute ID not found. Quick actions disabled.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
