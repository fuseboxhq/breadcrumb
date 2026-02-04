import { useQuery } from '@tanstack/react-query';
import { fetchIssues } from '../lib/api';

export function useIssues(projectPath: string | null, epicId?: string) {
  return useQuery({
    queryKey: ['issues', projectPath, epicId],
    queryFn: () => fetchIssues(projectPath!, epicId),
    enabled: !!projectPath,
    staleTime: 30_000,
  });
}
