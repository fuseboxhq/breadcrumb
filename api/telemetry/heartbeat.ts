import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { machineId, version, os, platform, arch, projectCount } = req.body;

    if (!machineId || !version) {
      return res.status(400).json({ error: 'machineId and version required' });
    }

    const sql = neon(process.env.DATABASE_URL!);

    await sql`
      INSERT INTO heartbeats (machine_id, version, os, platform, arch, project_count, created_at)
      VALUES (${machineId}, ${version}, ${os || 'unknown'}, ${platform || 'unknown'}, ${arch || 'unknown'}, ${projectCount || 0}, NOW())
    `;

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Heartbeat error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
