import NextLink from "next/link";
import { useRouter } from "next/router";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps {
  to: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  children?: React.ReactNode;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName: _pendingClassName, to, children, ...props }, ref) => {
    const router = useRouter();
    
    // Check for exact match or if current path starts with nav item path (for nested routes)
    const isDashboardRoot = to === '/dashboard/teacher' || to === '/dashboard/student' || to === '/dashboard/admin';
    const isActive = 
      router.pathname === to || 
      router.asPath === to ||
      (!isDashboardRoot && (router.pathname.startsWith(to + '/') || router.asPath.startsWith(to + '/')));
    
    return (
      <NextLink
        ref={ref}
        href={to}
        className={cn(className, isActive && activeClassName)}
        {...props}
      >
        {children}
      </NextLink>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
