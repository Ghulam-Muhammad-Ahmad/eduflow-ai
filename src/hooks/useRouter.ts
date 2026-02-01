import { useRouter as useNextRouter } from "next/router";

// Compatibility hook for migrating from react-router-dom to Next.js
export function useRouter() {
  const router = useNextRouter();

  return {
    push: (path: string) => router.push(path),
    replace: (path: string) => router.replace(path),
    back: () => router.back(),
    pathname: router.pathname,
    query: router.query,
    asPath: router.asPath,
  };
}

export function useParams<T extends Record<string, string>>(): T {
  const router = useNextRouter();
  return router.query as T;
}

export function useLocation() {
  const router = useNextRouter();
  return {
    pathname: router.pathname,
    search: router.asPath.split('?')[1] || '',
    hash: '',
    state: undefined,
  };
}
