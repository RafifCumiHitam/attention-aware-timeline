"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TimelinePage() {
  return (
    <div>
      <PageHeader
        title="Adaptive Timeline"
        description="Your personalized learning path powered by attention data"
      />
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Coming soon — structure is ready for feature development.</CardDescription>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Feature scaffold ready. Connect backend and implement business logic next.
        </CardContent>
      </Card>
    </div>
  );
}
