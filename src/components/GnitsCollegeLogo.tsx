export function GnitsCollegeLogo({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 select-none ${className}`}>
      <img
        src="/assets/gnits-college-logo.png"
        alt="G. Narayanamma Institute of Technology & Science"
        className="h-full w-full object-contain drop-shadow-sm pointer-events-none"
        loading="eager"
      />
    </div>
  );
}
