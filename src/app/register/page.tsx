
import RegisterInstituteForm from '@/components/RegisterInstituteForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/30 p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Register Your Institute</CardTitle>
          <CardDescription>Join AttendEase and streamline your attendance process.</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterInstituteForm />
        </CardContent>
      </Card>
      <footer className="py-8 text-center text-muted-foreground mt-auto">
        <p>&copy; {new Date().getFullYear()} AttendEase. All rights reserved.</p>
      </footer>
    </div>
  );
}
