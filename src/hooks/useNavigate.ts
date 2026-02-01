import { useRouter } from "next/router";

// Compatibility hook for migrating from react-router-dom to Next.js
export function useNavigate() {
  const router = useRouter();

  return (path: string, options?: { replace?: boolean }) => {
    if (options?.replace) {
      router.replace(path);
    } else {
      router.push(path);
    }
  };
}
