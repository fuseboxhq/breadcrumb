import { useQuery } from '@tanstack/react-query';
import { fetchProjects } from '../lib/api';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    staleTime: 30_000,
  });
}
