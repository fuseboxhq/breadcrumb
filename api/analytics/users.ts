import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const days = parseInt(req.query.days as string) || 30;

    const [dau, wau, total] = await Promise.all([
      // Daily active users (unique machine_ids per day)
      sql`
        SELECT
          DATE_TRUNC('day', created_at)::date AS date,
          COUNT(DISTINCT machine_id)::int AS count
        FROM heartbeats
        WHERE created_at >= NOW() - make_interval(days => ${days})
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date ASC
      `,
      // Weekly active users (unique machine_ids per week)
      sql`
        SELECT
          DATE_TRUNC('week', created_at)::date AS week,
          COUNT(DISTINCT machine_id)::int AS count
        FROM heartbeats
        WHERE created_at >= NOW() - make_interval(days => ${days})
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY week ASC
      `,
      // Total unique machines ever
      sql`SELECT COUNT(DISTINCT machine_id)::int AS total FROM heartbeats`,
    ]);

    return res.status(200).json({ dau, wau, totalUnique: total[0]?.total || 0 });
  } catch (e) {
    console.error('Analytics users error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
