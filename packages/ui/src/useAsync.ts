import { useCallback, useEffect, useState, type DependencyList } from "react";

export function useAsync<T>(
  loader: () => Promise<T>,
  dependencies: DependencyList,
) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    loader()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason
              : new Error("Ocorreu um erro inesperado."),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [...dependencies, revision]);

  return { data, error, loading, reload, setData };
}
