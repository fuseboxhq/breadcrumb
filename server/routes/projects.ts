import { Router } from 'express';
import { getRegisteredProjects, registerProject, unregisterProject } from '../services/registryService.js';
import { watchProject } from '../services/fileWatcher.js';
import { broadcastUpdate } from './watch.js';

const router = Router();

router.get('/projects', (_req, res) => {
  try {
    const projects = getRegisteredProjects();
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects', (req, res) => {
  const { path, name } = req.body;
  if (!path || !name) {
    res.status(400).json({ error: 'path and name are required' });
    return;
  }

  try {
    const project = registerProject(path, name);

    // Start watching the new project
    watchProject(path, (event, filePath) => {
      broadcastUpdate(event, filePath, path);
    });

    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/projects/:path', (req, res) => {
  const projectPath = decodeURIComponent(req.params.path);
  try {
    const removed = unregisterProject(projectPath);
    if (!removed) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ removed: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
