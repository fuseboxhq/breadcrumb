import { useMemo, useState } from 'react';
import { BarList } from '@tremor/react';
import type { GeoData } from '../../lib/analyticsApi';
import { Skeleton } from '../ui/Skeleton';

interface GeoChartProps {
  data: GeoData | undefined;
  isLoading: boolean;
}

// ISO 3166-1 alpha-2 → country name (common ones)
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', DE: 'Germany', FR: 'France',
  CA: 'Canada', AU: 'Australia', JP: 'Japan', IN: 'India', BR: 'Brazil',
  NL: 'Netherlands', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
  ES: 'Spain', IT: 'Italy', PT: 'Portugal', PL: 'Poland', CH: 'Switzerland',
  AT: 'Austria', BE: 'Belgium', IE: 'Ireland', NZ: 'New Zealand', SG: 'Singapore',
  KR: 'South Korea', CN: 'China', TW: 'Taiwan', HK: 'Hong Kong', IL: 'Israel',
  ZA: 'South Africa', MX: 'Mexico', AR: 'Argentina', CL: 'Chile', CO: 'Colombia',
  RU: 'Russia', UA: 'Ukraine', CZ: 'Czech Republic', RO: 'Romania', HU: 'Hungary',
  TR: 'Turkey', TH: 'Thailand', ID: 'Indonesia', PH: 'Philippines', VN: 'Vietnam',
  MY: 'Malaysia', PK: 'Pakistan', BD: 'Bangladesh', NG: 'Nigeria', KE: 'Kenya',
  EG: 'Egypt', AE: 'UAE', SA: 'Saudi Arabia', unknown: 'Unknown',
};

// Country code → flag emoji
function countryFlag(code: string): string {
  if (code === 'unknown' || code.length !== 2) return '';
  const offset = 127397;
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + offset));
}

function formatCountry(code: string): string {
  const flag = countryFlag(code);
  const name = COUNTRY_NAMES[code] || code;
  return flag ? `${flag} ${name}` : name;
}

type Tab = 'installs' | 'users';

export function GeoChart({ data, isLoading }: GeoChartProps) {
  const [tab, setTab] = useState<Tab>('installs');

  const installBars = useMemo(() => {
    if (!data?.installsByCountry) return [];
    return data.installsByCountry
      .filter(d => d.country !== 'unknown')
      .map(d => ({ name: formatCountry(d.country), value: d.count }));
  }, [data]);

  const userBars = useMemo(() => {
    if (!data?.usersByCountry) return [];
    return data.usersByCountry
      .filter(d => d.country !== 'unknown')
      .map(d => ({ name: formatCountry(d.country), value: d.count }));
  }, [data]);

  const bars = tab === 'installs' ? installBars : userBars;

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">
          Top Countries
        </h3>
        <div className="flex items-center rounded-md border border-border bg-surface">
          <button
            onClick={() => setTab('installs')}
            className={`px-2 py-0.5 text-2xs font-medium transition-colors ${
              tab === 'installs' ? 'text-accent bg-accent-muted' : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Installs
          </button>
          <button
            onClick={() => setTab('users')}
            className={`px-2 py-0.5 text-2xs font-medium transition-colors ${
              tab === 'users' ? 'text-accent bg-accent-muted' : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Users
          </button>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full rounded" />
          ))}
        </div>
      ) : bars.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-text-tertiary">
          No geo data yet
        </div>
      ) : (
        <BarList data={bars} color="violet" className="mt-2" />
      )}
    </div>
  );
}
