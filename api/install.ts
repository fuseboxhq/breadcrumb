import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { createHash } from 'crypto';

const INSTALL_SCRIPT_URL = 'https://raw.githubusercontent.com/fuseboxhq/breadcrumb/main/install.sh';

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function parseUserAgent(ua: string): { os: string; arch: string } {
  const lower = ua.toLowerCase();

  let os = 'unknown';
  if (lower.includes('darwin') || lower.includes('macos') || lower.includes('mac os')) os = 'macos';
  else if (lower.includes('linux')) os = 'linux';
  else if (lower.includes('windows') || lower.includes('win')) os = 'windows';

  let arch = 'unknown';
  if (lower.includes('x86_64') || lower.includes('amd64') || lower.includes('x64')) arch = 'x86_64';
  else if (lower.includes('arm64') || lower.includes('aarch64')) arch = 'arm64';
  else if (lower.includes('arm')) arch = 'arm';

  return { os, arch };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Fetch the install script from GitHub
  const scriptRes = await fetch(INSTALL_SCRIPT_URL);
  if (!scriptRes.ok) {
    return res.status(502).send('Failed to fetch install script');
  }

  const script = await scriptRes.text();

  // Log the install event (fire-and-forget)
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';
    const ua = (req.headers['user-agent'] as string) || '';
    const { os, arch } = parseUserAgent(ua);

    // Extract version from query param or default
    const version = (req.query.v as string) || 'unknown';

    await sql`
      INSERT INTO installs (ip_hash, user_agent, os, arch, version, created_at)
      VALUES (${hashIp(ip)}, ${ua.slice(0, 256)}, ${os}, ${arch}, ${version}, NOW())
    `;
  } catch (e) {
    // Don't block the install if logging fails
    console.error('Failed to log install:', e);
  }

  // Serve the script
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).send(script);
}
