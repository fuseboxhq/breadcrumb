import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const days = parseInt(req.query.days as string) || 30;

    const [daily, total] = await Promise.all([
      sql`
        SELECT
          DATE_TRUNC('day', created_at)::date AS date,
          COUNT(*)::int AS count
        FROM installs
        WHERE created_at >= NOW() - make_interval(days => ${days})
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date ASC
      `,
      sql`SELECT COUNT(*)::int AS total FROM installs`,
    ]);

    return res.status(200).json({ daily, total: total[0]?.total || 0 });
  } catch (e) {
    console.error('Analytics installs error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
