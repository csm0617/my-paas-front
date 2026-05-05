export type BaseDomainConfig = {
  scheme: 'http' | 'https';
  host: string;
};

export const parseBaseDomain = (
  raw: string | undefined,
  defaultScheme: 'http' | 'https' = 'https'
): BaseDomainConfig => {
  const v = (raw || '').trim();
  if (!v) return { scheme: defaultScheme, host: '' };
  if (v.startsWith('http://') || v.startsWith('https://')) {
    const u = new URL(v);
    const scheme = u.protocol.replace(':', '');
    return { scheme: (scheme === 'http' ? 'http' : 'https'), host: u.host };
  }
  return { scheme: defaultScheme, host: v };
};

export const buildEntryDomain = (appName: string, namespace: string, baseHost: string) => {
  const a = appName.trim();
  const ns = namespace.trim();
  const host = baseHost.trim();
  if (!a || !ns || !host) return '';
  return `${a}.${ns}.${host}`;
};

export const buildEntryUrl = (scheme: string, domain: string, path: string) => {
  const p = (path || '/').trim() || '/';
  const normalizedPath = p.startsWith('/') ? p : `/${p}`;
  const d = domain.trim();
  if (!d) return '';
  return `${scheme}://${d}${normalizedPath}`;
};

