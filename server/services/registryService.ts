import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface RegisteredProject {
  path: string;
  name: string;
  registeredAt: string;
}

const BREADCRUMB_DIR = join(homedir(), '.breadcrumb');
const REGISTRY_FILE = join(BREADCRUMB_DIR, 'projects.json');

function ensureDir(): void {
  if (!existsSync(BREADCRUMB_DIR)) {
    mkdirSync(BREADCRUMB_DIR, { recursive: true });
  }
}

export function getRegisteredProjects(): RegisteredProject[] {
  if (!existsSync(REGISTRY_FILE)) return [];
  try {
    const content = readFileSync(REGISTRY_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export function registerProject(projectPath: string, name: string): RegisteredProject {
  ensureDir();
  const projects = getRegisteredProjects();

  const existing = projects.find(p => p.path === projectPath);
  if (existing) {
    existing.name = name;
    writeFileSync(REGISTRY_FILE, JSON.stringify(projects, null, 2));
    return existing;
  }

  const project: RegisteredProject = {
    path: projectPath,
    name,
    registeredAt: new Date().toISOString(),
  };

  projects.push(project);
  writeFileSync(REGISTRY_FILE, JSON.stringify(projects, null, 2));
  return project;
}

export function unregisterProject(projectPath: string): boolean {
  const projects = getRegisteredProjects();
  const index = projects.findIndex(p => p.path === projectPath);
  if (index === -1) return false;

  projects.splice(index, 1);
  ensureDir();
  writeFileSync(REGISTRY_FILE, JSON.stringify(projects, null, 2));
  return true;
}
