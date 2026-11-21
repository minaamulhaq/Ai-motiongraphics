export function generationIdentity(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const {projectId, runId} = value as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof projectId !== "string" || typeof runId !== "string" || !uuid.test(projectId) || !uuid.test(runId)) return null;
  return {projectId, runId};
}
