"use client";

import { motion } from "framer-motion";
import {
  Eye,
  Clock,
  TrendingUp,
  BookOpen,
  PlayCircle,
  ArrowRight,
  Flame,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";

const stats = [
  { label: "Attention Score", value: "87%", icon: Eye, change: "+5%", color: "text-emerald-500" },
  { label: "Study Time", value: "4.2h", icon: Clock, change: "+1.2h", color: "text-blue-500" },
  { label: "Focus Streak", value: "12 days", icon: Flame, change: "Best!", color: "text-orange-500" },
  { label: "Lessons Done", value: "28", icon: BookOpen, change: "+3", color: "text-violet-500" },
];

const recentSessions = [
  { title: "Introduction to Neural Networks", progress: 100, duration: "32 min", attention: 92 },
  { title: "Attention Mechanisms Deep Dive", progress: 65, duration: "18 min", attention: 78 },
  { title: "Transformers Architecture", progress: 40, duration: "12 min", attention: 85 },
  { title: "Computer Vision Basics", progress: 100, duration: "45 min", attention: 91 },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Here is your learning overview for today."
        actions={
          <Button asChild className="gap-2">
            <Link href="/learn">
              <PlayCircle className="h-4 w-4" />
              Continue Learning
            </Link>
          </Button>
        }
      />

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={item}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription>{stat.label}</CardDescription>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">
                    <span className={stat.color}>{stat.change}</span> from last week
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Recent sessions */}
          <motion.div variants={item} className="lg:col-span-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Sessions</CardTitle>
                  <CardDescription>Your latest learning activity</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/sessions" className="gap-1">
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentSessions.map((session) => (
                  <div key={session.title} className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <PlayCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{session.title}</p>
                        <Badge variant={session.progress === 100 ? "success" : "secondary"}>
                          {session.progress}%
                        </Badge>
                      </div>
                      <Progress value={session.progress} className="h-1.5" />
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{session.duration}</span>
                        <span>Attention {session.attention}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Attention insight */}
          <motion.div variants={item} className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Attention Insight</CardTitle>
                <CardDescription>Peak focus windows today</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-center">
                  <div className="relative flex h-36 w-36 items-center justify-center">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                        strokeDasharray={`${87 * 2.64} ${100 * 2.64}`}
                        strokeLinecap="round"
                        className="text-primary transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <div className="text-3xl font-bold">87%</div>
                      <div className="text-xs text-muted-foreground">Avg Focus</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Morning (9–11)", value: 94 },
                    { label: "Afternoon (14–16)", value: 81 },
                    { label: "Evening (19–21)", value: 72 },
                  ].map((slot) => (
                    <div key={slot.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{slot.label}</span>
                        <span className="font-medium">{slot.value}%</span>
                      </div>
                      <Progress value={slot.value} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick actions */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                <Link href="/learn">
                  <PlayCircle className="h-6 w-6 text-primary" />
                  <span>Start Video Lesson</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                <Link href="/analytics">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  <span>View Analytics</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                <Link href="/timeline">
                  <BookOpen className="h-6 w-6 text-primary" />
                  <span>Adaptive Timeline</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
