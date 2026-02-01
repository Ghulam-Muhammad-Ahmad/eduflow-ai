import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, role, signOut } = useAuth();
  const router = useRouter();

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "For Teachers", href: "#teachers" },
    { label: "For Students", href: "#students" },
    { label: "Pricing", href: "#pricing" },
  ];

  const getDashboardPath = () => {
    switch (role) {
      case "teacher":
        return "/dashboard/teacher";
      case "student":
        return "/dashboard/student";
      case "admin":
        return "/dashboard/admin";
      default:
        return "/";
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <Image 
              src="/logolandscape.svg" 
              alt="EduLabLoom" 
              width={160} 
              height={32}
              className="h-8 w-auto group-hover:scale-105 transition-transform duration-300"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={getDashboardPath()}>Dashboard</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth">Log in</Link>
                </Button>
                <Button variant="default" size="sm" asChild>
                  <Link href="/auth">Get Started Free</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground hover:bg-secondary rounded-lg transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border/50 animate-fade-in">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary rounded-lg transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-4 mt-2 border-t border-border/50">
                {user ? (
                  <>
                    <Button variant="ghost" className="justify-start" asChild>
                      <Link href={getDashboardPath()} onClick={() => setIsOpen(false)}>
                        Dashboard
                      </Link>
                    </Button>
                    <Button variant="outline" onClick={() => { handleSignOut(); setIsOpen(false); }}>
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="justify-start" asChild>
                      <Link href="/auth" onClick={() => setIsOpen(false)}>Log in</Link>
                    </Button>
                    <Button variant="default" asChild>
                      <Link href="/auth" onClick={() => setIsOpen(false)}>Get Started Free</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
