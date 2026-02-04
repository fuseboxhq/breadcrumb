import { Router } from 'express';
import { getIssues, getIssue, getReadyIssues } from '../services/beadsService.js';

const router = Router();

router.get('/issues', (req, res) => {
  const projectPath = req.query.project as string;
  if (!projectPath) {
    res.status(400).json({ error: 'project query parameter required' });
    return;
  }

  const epicId = req.query.epic as string | undefined;

  try {
    const issues = getIssues(projectPath, epicId);
    res.json(issues);
  } catch (err: any) {
    if (err.code === 'SQLITE_CANTOPEN') {
      res.json([]);
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/issues/ready', (req, res) => {
  const projectPath = req.query.project as string;
  if (!projectPath) {
    res.status(400).json({ error: 'project query parameter required' });
    return;
  }

  try {
    const issues = getReadyIssues(projectPath);
    res.json(issues);
  } catch (err: any) {
    if (err.code === 'SQLITE_CANTOPEN') {
      res.json([]);
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/issues/:issueId', (req, res) => {
  const projectPath = req.query.project as string;
  if (!projectPath) {
    res.status(400).json({ error: 'project query parameter required' });
    return;
  }

  try {
    const issue = getIssue(projectPath, req.params.issueId);
    if (!issue) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }
    res.json(issue);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
