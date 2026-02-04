import { useQuery } from '@tanstack/react-query';
import { fetchResearch } from '../lib/api';

export function useResearch(projectPath: string | null) {
  return useQuery({
    queryKey: ['research', projectPath],
    queryFn: () => fetchResearch(projectPath!),
    enabled: !!projectPath,
    staleTime: 60_000,
  });
}
