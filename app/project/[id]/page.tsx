"use client";

import { useParams } from "next/navigation";
import ProjectWorkspace from "@/components/project-workspace";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  if (!id) {
    return null;
  }

  return <ProjectWorkspace id={id} />;
}
