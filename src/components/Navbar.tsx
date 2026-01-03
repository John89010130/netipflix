import { useState, useEffect } from 'react';
import { Search, Bell, ChevronDown, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { label: 'Início', href: '/' },
  { label: 'TV ao Vivo', href: '/tv' },
  { label: 'Filmes', href: '/movies' },
  { label: 'Minha Lista', href: '/my-list' },
];

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled ? "bg-background/95 backdrop-blur-md shadow-lg" : "bg-gradient-to-b from-background/80 to-transparent"
      )}
    >
      <nav className="flex items-center justify-between px-4 md:px-12 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-8">
          <h1 className="font-display text-2xl md:text-3xl text-primary tracking-widest">
            NETIPFLIX
          </h1>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "text-sm transition-colors hover:text-foreground",
                location.pathname === link.href ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className={cn(
            "flex items-center transition-all duration-300",
            isSearchOpen ? "w-48 md:w-64 bg-secondary/80 rounded px-3" : "w-auto"
          )}>
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-1"
            >
              <Search className="h-5 w-5" />
            </button>
            {isSearchOpen && (
              <input
                type="text"
                placeholder="Títulos, pessoas, gêneros"
                className="flex-1 bg-transparent py-2 pl-2 text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            )}
          </div>

          {/* Notifications */}
          <button className="hidden md:block">
            <Bell className="h-5 w-5" />
          </button>

          {/* Profile */}
          <button className="hidden md:flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary" />
            <ChevronDown className="h-4 w-4" />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-md border-t border-border animate-slide-up">
          <div className="flex flex-col px-4 py-4 gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "text-lg transition-colors hover:text-foreground py-2",
                  location.pathname === link.href ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex items-center gap-4 pt-4 border-t border-border">
              <div className="h-10 w-10 rounded bg-primary" />
              <div>
                <p className="font-medium">Usuário</p>
                <p className="text-sm text-muted-foreground">Gerenciar perfil</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
