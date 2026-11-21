"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import ProjectWorkspace from "@/components/project-workspace";
import { Loader2 } from "lucide-react";

function WorkspaceContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  if (!id) {
    return null;
  }

  return <ProjectWorkspace id={id} />;
}

export default function ProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="studio min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Opening your workspace…</p>
          </div>
        </div>
      }
    >
      <WorkspaceContent />
    </Suspense>
  );
}
