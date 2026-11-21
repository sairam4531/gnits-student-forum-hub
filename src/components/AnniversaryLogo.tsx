export function AnniversaryLogo({ className = "h-14 w-auto" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`} title="28 Years of Excellence">
      <svg
        viewBox="0 0 100 100"
        className="h-full w-auto drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Laurel Wreath */}
        <g stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.85">
          {/* Left Wreath Leaves */}
          <path d="M22 68 C16 55 16 35 25 22" />
          <ellipse cx="20" cy="62" rx="3" ry="1.5" transform="rotate(-30 20 62)" fill="#f59e0b" />
          <ellipse cx="17" cy="52" rx="3" ry="1.5" transform="rotate(-15 17 52)" fill="#f59e0b" />
          <ellipse cx="18" cy="42" rx="3" ry="1.5" transform="rotate(10 18 42)" fill="#f59e0b" />
          <ellipse cx="22" cy="32" rx="3" ry="1.5" transform="rotate(30 22 32)" fill="#f59e0b" />
          <ellipse cx="26" cy="24" rx="2.5" ry="1.2" transform="rotate(45 26 24)" fill="#f59e0b" />

          {/* Right Wreath Leaves */}
          <path d="M78 68 C84 55 84 35 75 22" />
          <ellipse cx="80" cy="62" rx="3" ry="1.5" transform="rotate(30 80 62)" fill="#f59e0b" />
          <ellipse cx="83" cy="52" rx="3" ry="1.5" transform="rotate(15 83 52)" fill="#f59e0b" />
          <ellipse cx="82" cy="42" rx="3" ry="1.5" transform="rotate(-10 82 42)" fill="#f59e0b" />
          <ellipse cx="78" cy="32" rx="3" ry="1.5" transform="rotate(-30 78 32)" fill="#f59e0b" />
          <ellipse cx="74" cy="24" rx="2.5" ry="1.2" transform="rotate(-45 74 24)" fill="#f59e0b" />
        </g>

        {/* Outer Circular Ring */}
        <circle cx="50" cy="45" r="33" stroke="#1e3a8a" strokeWidth="3" fill="#ffffff" />
        <circle cx="50" cy="45" r="29" stroke="#93c5fd" strokeWidth="1" strokeDasharray="2 2" fill="none" />

        {/* Central "28" */}
        <text
          x="50"
          y="45"
          textAnchor="middle"
          fontSize="24"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#1e3a8a"
          letterSpacing="-1"
        >
          28
        </text>

        {/* "Years" Label */}
        <text
          x="50"
          y="56"
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#1e3a8a"
          letterSpacing="0.8"
        >
          YEARS
        </text>

        {/* Bottom Ribbon Banner */}
        <g>
          {/* Ribbon Ends */}
          <path d="M12 76 L22 70 L22 84 L12 80 Z" fill="#1e3a8a" />
          <path d="M88 76 L78 70 L78 84 L88 80 Z" fill="#1e3a8a" />

          {/* Ribbon Center Arch */}
          <path
            d="M18 73 C30 79 70 79 82 73 L84 82 C70 88 30 88 16 82 Z"
            fill="#1e40af"
            stroke="#172554"
            strokeWidth="0.8"
          />

          {/* Ribbon Text "of Excellence" */}
          <text
            x="50"
            y="81"
            textAnchor="middle"
            fontSize="6.8"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill="#ffffff"
            letterSpacing="0.5"
          >
            of Excellence
          </text>
        </g>
      </svg>
    </div>
  );
}
