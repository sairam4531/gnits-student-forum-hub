export function GnitsCollegeLogo({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 select-none ${className}`}>
      <svg
        viewBox="0 0 120 120"
        className="h-full w-full drop-shadow-sm"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Ring */}
        <circle cx="60" cy="60" r="58" fill="#ffffff" stroke="#1e3a8a" strokeWidth="3" />
        <circle cx="60" cy="60" r="54" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="39" fill="#eff6ff" stroke="#1e3a8a" strokeWidth="2" />

        {/* Circular Curved Text Paths */}
        <defs>
          <path
            id="topCirclePath"
            d="M 16,60 A 44,44 0 1,1 104,60"
            fill="none"
          />
          <path
            id="bottomCirclePath"
            d="M 104,60 A 44,44 0 0,1 16,60"
            fill="none"
          />
        </defs>

        {/* Top Text: G. NARAYANAMMA INSTITUTE */}
        <text
          fontSize="7.2"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#1e3a8a"
          letterSpacing="0.4"
        >
          <textPath href="#topCirclePath" startOffset="50%" textAnchor="middle">
            G. NARAYANAMMA INSTITUTE OF TECH &amp; SCI
          </textPath>
        </text>

        {/* Bottom Text: FOR WOMEN • HYDERABAD */}
        <text
          fontSize="6.8"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#1e3a8a"
          letterSpacing="0.5"
        >
          <textPath href="#bottomCirclePath" startOffset="50%" textAnchor="middle">
            FOR WOMEN • HYDERABAD
          </textPath>
        </text>

        {/* Inner Symbol: Book + Jyothi (Knowledge Lamp) */}
        {/* Open Book */}
        <path
          d="M 44,72 C 50,68 56,69 60,71 C 64,69 70,68 76,72 L 76,64 C 70,61 64,62 60,64 C 56,62 50,61 44,64 Z"
          fill="#3b82f6"
          stroke="#1e3a8a"
          strokeWidth="1"
        />

        {/* Lamp Base */}
        <path
          d="M 52,62 L 68,62 C 67,65 65,66 60,66 C 55,66 53,65 52,62 Z"
          fill="#f59e0b"
          stroke="#b45309"
          strokeWidth="0.8"
        />

        {/* Lamp Flame (Jyothi) */}
        <path
          d="M 60,45 C 57,51 55,54 55,57 C 55,60 57,62 60,62 C 63,62 65,60 65,57 C 65,54 63,51 60,45 Z"
          fill="#ef4444"
        />
        <path
          d="M 60,49 C 58,53 57,55 57,57 C 57,59 58,60 60,60 C 62,60 63,59 63,57 C 63,55 62,53 60,49 Z"
          fill="#fbbf24"
        />

        {/* Small Rays */}
        <line x1="60" y1="41" x2="60" y2="43" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="53" y1="44" x2="55" y2="46" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="67" y1="44" x2="65" y2="46" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
