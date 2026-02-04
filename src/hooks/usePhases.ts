import { useQuery } from '@tanstack/react-query';
import { fetchPhases, fetchPhase } from '../lib/api';

export function usePhases(projectPath: string | null) {
  return useQuery({
    queryKey: ['phases', projectPath],
    queryFn: () => fetchPhases(projectPath!),
    enabled: !!projectPath,
    staleTime: 30_000,
  });
}

export function usePhase(projectPath: string | null, phaseId: string | null) {
  return useQuery({
    queryKey: ['phase', projectPath, phaseId],
    queryFn: () => fetchPhase(projectPath!, phaseId!),
    enabled: !!projectPath && !!phaseId,
    staleTime: 60_000,
  });
}
