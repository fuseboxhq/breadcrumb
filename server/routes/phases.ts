import { Router } from 'express';
import { getPhases, getPhase, getProjectState, getResearchDocs } from '../services/planningService.js';

const router = Router();

router.get('/phases', (req, res) => {
  const projectPath = req.query.project as string;
  if (!projectPath) {
    res.status(400).json({ error: 'project query parameter required' });
    return;
  }

  try {
    const phases = getPhases(projectPath);
    res.json(phases);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/phases/:phaseId', (req, res) => {
  const projectPath = req.query.project as string;
  if (!projectPath) {
    res.status(400).json({ error: 'project query parameter required' });
    return;
  }

  try {
    const phase = getPhase(projectPath, req.params.phaseId);
    if (!phase) {
      res.status(404).json({ error: 'Phase not found' });
      return;
    }
    res.json(phase);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/state', (req, res) => {
  const projectPath = req.query.project as string;
  if (!projectPath) {
    res.status(400).json({ error: 'project query parameter required' });
    return;
  }

  try {
    const state = getProjectState(projectPath);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/research', (req, res) => {
  const projectPath = req.query.project as string;
  if (!projectPath) {
    res.status(400).json({ error: 'project query parameter required' });
    return;
  }

  try {
    const docs = getResearchDocs(projectPath);
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
