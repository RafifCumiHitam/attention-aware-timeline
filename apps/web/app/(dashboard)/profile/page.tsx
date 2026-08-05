"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <div>
      <PageHeader title="Profile" description="Your learner profile and achievements" />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{user?.name ?? "Guest User"}</CardTitle>
              <CardDescription>{user?.email ?? "Not signed in"}</CardDescription>
              <div className="mt-2 flex gap-2">
                <Badge variant="secondary">Learner</Badge>
                <Badge variant="success">12-day streak</Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Full profile management will be available once the backend is connected.
        </CardContent>
      </Card>
    </div>
  );
}
