"use client";

/**
 * Canonical Learning entry — live modules from PostgreSQL (authenticated).
 * Replaces hardcoded DEMO_VIDEO / lessons[] catalog.
 *
 * Flow: Modules → Module detail → Start session → /learn/watch?videoId&sessionId
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, PlayCircle, AlertCircle, LogIn } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listModules, type ModuleDto } from "@/features/modules/services/modules-api";
import { getAccessToken } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export default function LearnPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [modules, setModules] = useState<ModuleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const token = getAccessToken();
      if (!token) {
        if (!cancelled) {
          setError("You must sign in to load learning modules.");
          setModules([]);
          setLoading(false);
        }
        return;
      }

      try {
        const items = await listModules();
        if (!cancelled) setModules(items);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load modules");
          setModules([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Video Learning"
        description="Choose a module from the catalog — YouTube lessons backed by PostgreSQL"
      />

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          {(error.toLowerCase().includes("sign in") || error.toLowerCase().includes("log in")) && (
            <Button type="button" size="sm" className="gap-2" onClick={() => router.push("/login")}>
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : modules.length === 0 && !error ? (
        <Card>
          <CardHeader>
            <CardTitle>No modules yet</CardTitle>
            <CardDescription>
              Create a module and import YouTube videos from the module admin page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/learn/modules">Open modules manager</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link key={m.id} href={`/learn/modules/${m.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg leading-snug">{m.title}</CardTitle>
                  <CardDescription className="line-clamp-3">
                    {m.description || m.slug}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {m.id.slice(0, 8)}…
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <PlayCircle className="h-3.5 w-3.5" /> Open
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Catalog requires a valid JWT (Authorization Bearer). curl without a token will return 401 —
        that is expected. Sign in via /login so api-client attaches the token from localStorage
        (aat-auth).
      </p>
    </div>
  );
}
