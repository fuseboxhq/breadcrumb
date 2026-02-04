import { Router, type Request, type Response } from 'express';

const router = Router();

interface SSEClient {
  id: string;
  res: Response;
  projectPath: string | null;
}

const clients: SSEClient[] = [];
let clientIdCounter = 0;

router.get('/watch', (req: Request, res: Response) => {
  const projectPath = (req.query.project as string) || null;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const clientId = String(++clientIdCounter);
  const client: SSEClient = { id: clientId, res, projectPath };
  clients.push(client);

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const index = clients.findIndex(c => c.id === clientId);
    if (index !== -1) clients.splice(index, 1);
  });
});

export function broadcastUpdate(event: string, filePath: string, projectPath?: string): void {
  const data = JSON.stringify({ type: 'file_change', event, path: filePath, projectPath });

  for (const client of clients) {
    // Send to all clients, or only matching project if specified
    if (!projectPath || !client.projectPath || client.projectPath === projectPath) {
      client.res.write(`data: ${data}\n\n`);
    }
  }
}

export default router;
