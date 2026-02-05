import { useQuery } from '@tanstack/react-query';
import { fetchVersion } from '../lib/api';

export function useVersion() {
  return useQuery({
    queryKey: ['version'],
    queryFn: fetchVersion,
    staleTime: Infinity,
  });
}
