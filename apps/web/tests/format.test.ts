import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatMs,
  formatPercent,
  formatRelative,
  INCIDENT_STATUS_META,
  normalizePathname,
  SEVERITY_META,
  STATUS_META,
} from '@/lib/format';

describe('format helpers', () => {
  it('never invents a percentage when data is missing', () => {
    expect(formatPercent(null)).toBe('No data');
    expect(formatPercent(undefined)).toBe('No data');
    expect(formatPercent(99.123)).toBe('99.12%');
  });

  it('formats latency and duration honestly', () => {
    expect(formatMs(null)).toBe('—');
    expect(formatMs(12.4)).toBe('12 ms');
    expect(formatMs(1500)).toBe('1.50 s');
    expect(formatDuration(null)).toBe('Ongoing');
    expect(formatDuration(65)).toBe('1m 5s');
    expect(formatDuration(3660)).toBe('1h 1m');
  });

  it('handles missing and invalid timestamps', () => {
    expect(formatRelative(null)).toBe('Never');
    expect(formatRelative('not-a-date')).toBe('Never');
  });

  it('normalizes static-export trailing slashes for route matching', () => {
    expect(normalizePathname('/register/')).toBe('/register');
    expect(normalizePathname('/login/')).toBe('/login');
    expect(normalizePathname('/monitor/')).toBe('/monitor');
    expect(normalizePathname('/')).toBe('/');
    expect(normalizePathname('')).toBe('/');
    expect(normalizePathname(null)).toBe('/');
  });

  it('defines every monitor, incident, and severity state', () => {
    expect(Object.keys(STATUS_META)).toEqual([
      'OPERATIONAL',
      'DEGRADED',
      'DOWN',
      'PAUSED',
      'PENDING',
      'UNKNOWN',
    ]);
    expect(Object.keys(INCIDENT_STATUS_META)).toEqual(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']);
    expect(Object.keys(SEVERITY_META)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
  });
});
