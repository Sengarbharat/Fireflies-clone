"use client";

import { useCallback, useEffect, useState } from "react";
import { useSWRConfig } from "swr";

/** Revalidate every cached list/search/task query after a mutation. */
export function useInvalidate() {
  const { mutate } = useSWRConfig();
  return useCallback(
    () =>
      mutate(
        (key) =>
          typeof key === "string" &&
          /^\/api\/(meetings|search|action-items|tags|participants)/.test(key),
        undefined,
        { revalidate: true },
      ),
    [mutate],
  );
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
