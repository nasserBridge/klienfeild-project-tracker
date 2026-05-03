import { ProjectShell } from "@/components/project-shell";

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  return <ProjectShell projectId={decodeURIComponent(params.projectId)} />;
}
