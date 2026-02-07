import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const days = parseInt(req.query.days as string) || 30;

    const [current, adoption] = await Promise.all([
      // Current version distribution (latest heartbeat per machine)
      sql`
        SELECT
          COALESCE(version, 'unknown') AS version,
          COUNT(*)::int AS count
        FROM (
          SELECT DISTINCT ON (machine_id) machine_id, version
          FROM heartbeats
          WHERE created_at >= NOW() - make_interval(days => ${days})
          ORDER BY machine_id, created_at DESC
        ) latest
        GROUP BY version
        ORDER BY count DESC
      `,
      // Version adoption over time (daily)
      sql`
        SELECT
          DATE_TRUNC('day', created_at)::date AS date,
          COALESCE(version, 'unknown') AS version,
          COUNT(DISTINCT machine_id)::int AS count
        FROM heartbeats
        WHERE created_at >= NOW() - make_interval(days => ${days})
        GROUP BY DATE_TRUNC('day', created_at), version
        ORDER BY date ASC, count DESC
      `,
    ]);

    return res.status(200).json({ current, adoption });
  } catch (e) {
    console.error('Analytics versions error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
