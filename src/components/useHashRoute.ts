import { useCallback, useEffect, useState } from 'react';

export type Route = { name: 'library' } | { name: 'artwork'; id: string };

const PREFIX = 'art-';

function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  return h.startsWith(PREFIX) && h.length > PREFIX.length
    ? { name: 'artwork', id: decodeURIComponent(h.slice(PREFIX.length)) }
    : { name: 'library' };
}

/** Tiny hash router: no hash is the library, "#art-<id>" an artwork. */
export function useHashRoute(): [Route, (r: Route, replace?: boolean) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((r: Route, replace = false) => {
    const hash = r.name === 'artwork' ? `#${PREFIX}${encodeURIComponent(r.id)}` : '';
    try {
      if (replace) window.location.replace(hash || '#');
      else window.location.hash = hash;
    } catch {
      /* some embedded viewers refuse hash changes; state below still updates */
    }
    setRoute(r);
  }, []);
  return [route, go];
}
