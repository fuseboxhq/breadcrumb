import { useQuery } from '@tanstack/react-query';
import { fetchProjectState } from '../lib/api';

export function useProjectState(projectPath: string | null) {
  return useQuery({
    queryKey: ['state', projectPath],
    queryFn: () => fetchProjectState(projectPath!),
    enabled: !!projectPath,
    staleTime: 30_000,
  });
}
