import { useQuery } from '@tanstack/react-query';
import { fetchReadyIssues } from '../lib/api';

export function useReadyIssues(projectPath: string | null) {
  return useQuery({
    queryKey: ['issues', projectPath, 'ready'],
    queryFn: () => fetchReadyIssues(projectPath!),
    enabled: !!projectPath,
    staleTime: 30_000,
  });
}
