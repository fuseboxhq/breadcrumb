import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { machineId, commands } = req.body;

    if (!machineId || !Array.isArray(commands) || commands.length === 0) {
      return res.status(400).json({ error: 'machineId and commands[] required' });
    }

    const sql = neon(process.env.DATABASE_URL!);

    // Batch insert command events
    for (const cmd of commands) {
      if (!cmd.name) continue;
      await sql`
        INSERT INTO command_events (machine_id, command_name, count, created_at)
        VALUES (${machineId}, ${cmd.name}, ${cmd.count || 1}, ${cmd.timestamp || new Date().toISOString()})
      `;
    }

    return res.status(200).json({ ok: true, inserted: commands.length });
  } catch (e) {
    console.error('Command telemetry error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
