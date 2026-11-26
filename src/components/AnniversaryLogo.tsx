export function AnniversaryLogo({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center flex-shrink-0 overflow-hidden select-none ${className}`}
      title="28 Years of Excellence"
    >
      <img
        src="/assets/gnits-28-years-logo.png"
        alt="28 Years of Excellence - GNITS"
        className="h-full w-full object-contain scale-[1.45] drop-shadow-sm pointer-events-none"
        loading="eager"
      />
    </div>
  );
}
