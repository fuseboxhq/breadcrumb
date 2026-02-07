import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const days = parseInt(req.query.days as string) || 30;

    const [popularity, daily] = await Promise.all([
      // Command popularity (total usage counts)
      sql`
        SELECT
          command_name AS name,
          SUM(count)::int AS total
        FROM command_events
        WHERE created_at >= NOW() - make_interval(days => ${days})
        GROUP BY command_name
        ORDER BY total DESC
        LIMIT 20
      `,
      // Daily command usage over time
      sql`
        SELECT
          DATE_TRUNC('day', created_at)::date AS date,
          command_name AS name,
          SUM(count)::int AS total
        FROM command_events
        WHERE created_at >= NOW() - make_interval(days => ${days})
        GROUP BY DATE_TRUNC('day', created_at), command_name
        ORDER BY date ASC, total DESC
      `,
    ]);

    return res.status(200).json({ popularity, daily });
  } catch (e) {
    console.error('Analytics commands error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
