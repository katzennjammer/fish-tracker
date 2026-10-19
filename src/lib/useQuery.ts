import { useEffect, useState } from 'react';
import { subscribe } from './db';

/**
 * Runs an async read and re-runs it whenever `deps` change or any write
 * happens anywhere in the app, so every screen stays current without manual
 * refreshes. The previous result stays visible while the next one loads.
 */
export function useQuery<T>(load: () => Promise<T>, deps: unknown[]): T | undefined {
  const [data, setData] = useState<T>();
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(deps);

  useEffect(() => subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let live = true;
    load().then(
      (value) => {
        if (live) setData(value);
      },
      (err) => console.warn('query failed', err),
    );
    return () => {
      live = false;
    };
    // `load` is a fresh closure every render; `key` captures what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  return data;
}
