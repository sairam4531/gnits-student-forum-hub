import { Link } from "@tanstack/react-router";
import { GraduationCap, ShieldCheck, Home } from "lucide-react";

interface HeaderProps {
  isAdmin?: boolean;
}

export function Header({ isAdmin = false }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 transition-all">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <Link to="/" className="flex items-center gap-3.5 group">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition-transform duration-300 group-hover:scale-105">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-black tracking-tight text-foreground leading-snug">
              GNITS STUDENT COUNCIL
            </span>
            <span className="text-[11px] sm:text-xs text-muted-foreground font-medium line-clamp-1">
              G. Narayanamma Institute of Technology & Science (Autonomous, For Women)
            </span>
          </div>
        </Link>

        {/* Navigation Action */}
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs sm:text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <Home className="h-4 w-4" />
              <span>Student View</span>
            </Link>
          ) : (
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs sm:text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Admin Portal</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
