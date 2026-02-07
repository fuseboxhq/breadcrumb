import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const days = parseInt(req.query.days as string) || 30;

    const [byOs, byArch, combined] = await Promise.all([
      // OS distribution from heartbeats
      sql`
        SELECT
          COALESCE(os, 'unknown') AS os,
          COUNT(DISTINCT machine_id)::int AS count
        FROM heartbeats
        WHERE created_at >= NOW() - make_interval(days => ${days})
        GROUP BY os
        ORDER BY count DESC
      `,
      // Architecture distribution from heartbeats
      sql`
        SELECT
          COALESCE(arch, 'unknown') AS arch,
          COUNT(DISTINCT machine_id)::int AS count
        FROM heartbeats
        WHERE created_at >= NOW() - make_interval(days => ${days})
        GROUP BY arch
        ORDER BY count DESC
      `,
      // OS + arch combined from installs
      sql`
        SELECT
          COALESCE(os, 'unknown') AS os,
          COALESCE(arch, 'unknown') AS arch,
          COUNT(*)::int AS count
        FROM installs
        WHERE created_at >= NOW() - make_interval(days => ${days})
        GROUP BY os, arch
        ORDER BY count DESC
      `,
    ]);

    return res.status(200).json({ byOs, byArch, combined });
  } catch (e) {
    console.error('Analytics OS error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
