import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useWatchProject(projectPath: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectPath) return;

    const params = new URLSearchParams({ project: projectPath });
    const eventSource = new EventSource(`/api/watch?${params}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'file_change') {
          // Invalidate relevant queries based on what changed
          if (data.path.includes('.planning')) {
            queryClient.invalidateQueries({ queryKey: ['phases', projectPath] });
            queryClient.invalidateQueries({ queryKey: ['phase', projectPath] });
            queryClient.invalidateQueries({ queryKey: ['state', projectPath] });
            queryClient.invalidateQueries({ queryKey: ['research', projectPath] });
          }
          if (data.path.includes('.beads')) {
            queryClient.invalidateQueries({ queryKey: ['issues', projectPath] });
          }
        }
      } catch {
        // Ignore parse errors (heartbeats, etc.)
      }
    };

    return () => {
      eventSource.close();
    };
  }, [projectPath, queryClient]);
}
