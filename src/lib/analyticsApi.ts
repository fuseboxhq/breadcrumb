const ANALYTICS_BASE = 'https://breadcrumb-beta.vercel.app/api/analytics';

export interface AnalyticsSummary {
  totalInstalls: number;
  totalMachines: number;
  dauToday: number;
  wauThisWeek: number;
  topCommands: { name: string; total: number }[];
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface InstallsData {
  daily: DailyCount[];
  total: number;
}

export interface UsersData {
  dau: DailyCount[];
  wau: { week: string; count: number }[];
  totalUnique: number;
}

export interface CommandPopularity {
  name: string;
  total: number;
}

export interface CommandDaily {
  date: string;
  name: string;
  total: number;
}

export interface CommandsData {
  popularity: CommandPopularity[];
  daily: CommandDaily[];
}

export interface OsEntry {
  os: string;
  count: number;
}

export interface ArchEntry {
  arch: string;
  count: number;
}

export interface OsCombinedEntry {
  os: string;
  arch: string;
  count: number;
}

export interface OsData {
  byOs: OsEntry[];
  byArch: ArchEntry[];
  combined: OsCombinedEntry[];
}

export interface VersionEntry {
  version: string;
  count: number;
}

export interface VersionAdoption {
  date: string;
  version: string;
  count: number;
}

export interface VersionsData {
  current: VersionEntry[];
  adoption: VersionAdoption[];
}

export interface CountryEntry {
  country: string;
  count: number;
}

export interface GeoData {
  installsByCountry: CountryEntry[];
  usersByCountry: CountryEntry[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Analytics API error: ${res.status}`);
  return res.json();
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  return fetchJson(`${ANALYTICS_BASE}/summary`);
}

export async function fetchInstalls(days = 30): Promise<InstallsData> {
  return fetchJson(`${ANALYTICS_BASE}/installs?days=${days}`);
}

export async function fetchUsers(days = 30): Promise<UsersData> {
  return fetchJson(`${ANALYTICS_BASE}/users?days=${days}`);
}

export async function fetchCommands(days = 30): Promise<CommandsData> {
  return fetchJson(`${ANALYTICS_BASE}/commands?days=${days}`);
}

export async function fetchOsBreakdown(days = 30): Promise<OsData> {
  return fetchJson(`${ANALYTICS_BASE}/os?days=${days}`);
}

export async function fetchVersions(days = 30): Promise<VersionsData> {
  return fetchJson(`${ANALYTICS_BASE}/versions?days=${days}`);
}

export async function fetchGeo(days = 30): Promise<GeoData> {
  return fetchJson(`${ANALYTICS_BASE}/geo?days=${days}`);
}
