import { useQuery } from '@tanstack/react-query';
import {
  fetchAnalyticsSummary,
  fetchInstalls,
  fetchUsers,
  fetchCommands,
  fetchOsBreakdown,
  fetchVersions,
} from '../lib/analyticsApi';

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: fetchAnalyticsSummary,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useInstalls(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'installs', days],
    queryFn: () => fetchInstalls(days),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useUsers(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'users', days],
    queryFn: () => fetchUsers(days),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCommands(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'commands', days],
    queryFn: () => fetchCommands(days),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useOsBreakdown(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'os', days],
    queryFn: () => fetchOsBreakdown(days),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useVersions(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'versions', days],
    queryFn: () => fetchVersions(days),
    staleTime: 60_000,
    retry: 1,
  });
}
