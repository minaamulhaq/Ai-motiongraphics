import { Suspense } from "react";
import Link from "next/link";
import ProjectWorkspace from "@/components/project-workspace";

type Props = { params: Promise<{ id: string }> };
async function WorkspaceRoute({ params }: Props) {
  const { id } = await params;
  return <ProjectWorkspace id={id}/>;
}
export default function ProjectPage(props: Props) {
  return <Suspense fallback={<div className="workspace-state" role="status"><p>Opening your workspace…</p><Link href="/">Back to studio</Link></div>}><WorkspaceRoute {...props}/></Suspense>;
}
