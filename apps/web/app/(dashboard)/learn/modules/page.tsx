"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createModule, listModules, type ModuleDto } from "@/features/modules/services/modules-api";

export default function ModulesListPage() {
  const [modules, setModules] = useState<ModuleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setModules(await listModules());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load modules");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await createModule({ title: title.trim() });
      setTitle("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Modules"
        description="YouTube-backed curriculum modules — select a module to start learning"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create module</CardTitle>
          <CardDescription>Developer / admin shortcut</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="Machine Learning Fundamentals"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="max-w-md"
          />
          <Button type="button" onClick={() => void onCreate()} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2">Create</span>
          </Button>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : modules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No modules yet. Create one above.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link key={m.id} href={`/learn/modules/${m.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{m.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {m.description || m.slug}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
