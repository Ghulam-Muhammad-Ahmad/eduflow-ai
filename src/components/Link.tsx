import NextLink from "next/link";
import { ReactNode } from "react";

interface LinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  replace?: boolean;
  scroll?: boolean;
}

// Compatibility wrapper for react-router-dom Link
export default function Link({ href, children, className, replace, scroll }: LinkProps) {
  return (
    <NextLink href={href} replace={replace} scroll={scroll} className={className}>
      {children}
    </NextLink>
  );
}
