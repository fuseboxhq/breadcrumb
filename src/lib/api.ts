import type { Phase, BeadsIssue, Project, ProjectState } from '../types';

const API_BASE = '/api';

export async function fetchProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/projects`);
  if (!response.ok) throw new Error('Failed to fetch projects');
  return response.json();
}

export async function fetchPhases(projectPath: string): Promise<Phase[]> {
  const response = await fetch(`${API_BASE}/phases?project=${encodeURIComponent(projectPath)}`);
  if (!response.ok) throw new Error('Failed to fetch phases');
  return response.json();
}

export async function fetchPhase(projectPath: string, phaseId: string): Promise<Phase> {
  const response = await fetch(
    `${API_BASE}/phases/${encodeURIComponent(phaseId)}?project=${encodeURIComponent(projectPath)}`
  );
  if (!response.ok) throw new Error('Failed to fetch phase');
  return response.json();
}

export async function fetchIssues(projectPath: string, epicId?: string): Promise<BeadsIssue[]> {
  const params = new URLSearchParams({ project: projectPath });
  if (epicId) params.set('epic', epicId);
  const response = await fetch(`${API_BASE}/issues?${params}`);
  if (!response.ok) throw new Error('Failed to fetch issues');
  return response.json();
}

export async function fetchProjectState(projectPath: string): Promise<ProjectState> {
  const response = await fetch(`${API_BASE}/state?project=${encodeURIComponent(projectPath)}`);
  if (!response.ok) throw new Error('Failed to fetch project state');
  return response.json();
}
