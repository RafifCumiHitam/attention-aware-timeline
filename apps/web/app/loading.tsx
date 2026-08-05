import { PageSkeleton } from "@/components/shared/loading-skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-5xl">
        <PageSkeleton />
      </div>
    </div>
  );
}
