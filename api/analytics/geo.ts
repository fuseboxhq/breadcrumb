import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const days = parseInt(req.query.days as string) || 30;

    const [installsByCountry, usersByCountry] = await Promise.all([
      // Install counts by country
      sql`
        SELECT
          COALESCE(country, 'unknown') AS country,
          COUNT(*)::int AS count
        FROM installs
        WHERE created_at >= NOW() - make_interval(days => ${days})
        GROUP BY country
        ORDER BY count DESC
        LIMIT 30
      `,
      // Unique active users by country (from heartbeats)
      sql`
        SELECT
          COALESCE(country, 'unknown') AS country,
          COUNT(DISTINCT machine_id)::int AS count
        FROM heartbeats
        WHERE created_at >= NOW() - make_interval(days => ${days})
        GROUP BY country
        ORDER BY count DESC
        LIMIT 30
      `,
    ]);

    return res.status(200).json({ installsByCountry, usersByCountry });
  } catch (e) {
    console.error('Analytics geo error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
