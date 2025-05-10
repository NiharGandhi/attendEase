
import LoginForm from '@/components/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <Link href="/" passHref>
            <h1 className="text-3xl font-bold text-primary cursor-pointer mb-2">AttendEase</h1>
          </Link>
          <CardTitle className="text-2xl font-semibold text-foreground">Login to Your Account</CardTitle>
          <CardDescription>Access your institute&apos;s dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
       <footer className="py-8 text-center text-muted-foreground mt-auto">
        <p>&copy; {new Date().getFullYear()} AttendEase. All rights reserved.</p>
      </footer>
    </div>
  );
}
