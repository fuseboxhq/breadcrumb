import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = neon(process.env.DATABASE_URL!);

    const [totalInstalls, totalMachines, dauToday, wauThisWeek, topCommands] = await Promise.all([
      sql`SELECT COUNT(*)::int AS total FROM installs`,
      sql`SELECT COUNT(DISTINCT machine_id)::int AS total FROM heartbeats`,
      sql`
        SELECT COUNT(DISTINCT machine_id)::int AS count
        FROM heartbeats
        WHERE created_at >= DATE_TRUNC('day', NOW())
      `,
      sql`
        SELECT COUNT(DISTINCT machine_id)::int AS count
        FROM heartbeats
        WHERE created_at >= DATE_TRUNC('week', NOW())
      `,
      sql`
        SELECT command_name AS name, SUM(count)::int AS total
        FROM command_events
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY command_name
        ORDER BY total DESC
        LIMIT 5
      `,
    ]);

    return res.status(200).json({
      totalInstalls: totalInstalls[0]?.total || 0,
      totalMachines: totalMachines[0]?.total || 0,
      dauToday: dauToday[0]?.count || 0,
      wauThisWeek: wauThisWeek[0]?.count || 0,
      topCommands,
    });
  } catch (e) {
    console.error('Analytics summary error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
