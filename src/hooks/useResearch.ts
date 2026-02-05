import { useQuery } from '@tanstack/react-query';
import { fetchResearch } from '../lib/api';

export function useResearch(projectPath: string | null, phaseId: string | null) {
  return useQuery({
    queryKey: ['research', projectPath, phaseId],
    queryFn: () => fetchResearch(projectPath!, phaseId!),
    enabled: !!projectPath && !!phaseId,
    staleTime: 60_000,
  });
}
