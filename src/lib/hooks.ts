import { useEffect, useMemo, useState } from 'react';
import { QueryConstraint, collection, onSnapshot, query } from 'firebase/firestore';
import { db } from './firebase';
import { withId } from './db';

export interface ColState<T> {
  data: T[] | null;
  error: Error | null;
}

/**
 * Live-subscribe to a Firestore collection. Pass null as `name` to skip
 * (e.g. while waiting for auth/season). `deps` should capture everything the
 * constraints close over.
 */
export function useCol<T extends { id: string }>(
  name: string | null,
  makeConstraints: () => QueryConstraint[],
  deps: unknown[],
): ColState<T> {
  const [state, setState] = useState<ColState<T>>({ data: null, error: null });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const constraints = useMemo(makeConstraints, deps);

  useEffect(() => {
    if (!name) {
      setState({ data: null, error: null });
      return;
    }
    const q = query(collection(db, name), ...constraints);
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map((d) => withId<T>(d.id, d.data())), error: null }),
      (error) => setState({ data: null, error }),
    );
  }, [name, constraints]);

  return state;
}

export function byId<T extends { id: string }>(items: T[] | null): Map<string, T> {
  return new Map((items ?? []).map((i) => [i.id, i]));
}
