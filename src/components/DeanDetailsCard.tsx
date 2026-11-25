import { useState, useEffect } from "react";
import { User, Mail, Building2 } from "lucide-react";
import type { DeanDetails } from "@/lib/local-homepage-store";

interface DeanDetailsCardProps {
  dean: DeanDetails;
  onOpenEventsDrawer?: () => void;
}

export function DeanDetailsCard({ dean }: DeanDetailsCardProps) {
  const name = dean.name || "Dr. Aparna Palle";
  const designation = dean.designation || "Dean, Student Affairs & Professor";
  const email = dean.email || "aparna.palle@gnits.ac.in";
  const office = dean.office || dean.contact_number || "Dean – Student Affairs, GNITS, Hyderabad";
  const photoUrl = (dean.profile_photo || "").trim();

  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [photoUrl]);

  return (
    <div className="w-full py-4">
      {/* Title with centered underline matching design */}
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-black text-[#0f2757] tracking-tight">
          Dean - Student Affairs Profile
        </h2>
        <div className="w-14 h-1 bg-[#0f2757] mx-auto mt-2.5 rounded-full" />
      </div>

      {/* Clean White Card with ONLY the requested data */}
      <div className="max-w-2xl mx-auto rounded-2xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
        {/* Left Side: Photo Frame with "Dean Photo" */}
        <div className="w-36 h-40 sm:w-40 sm:h-44 rounded-2xl border border-slate-300 flex flex-col items-center justify-center p-3 bg-slate-50/50 flex-shrink-0 overflow-hidden shadow-2xs">
          {photoUrl && !imageError ? (
            <img
              src={photoUrl}
              alt={name}
              className="w-full h-full object-cover rounded-xl"
              onError={() => setImageError(true)}
              loading="eager"
            />
          ) : (
            <>
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-200/80 flex items-center justify-center mb-2">
                <User className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-800">
                Dean Photo
              </span>
            </>
          )}
        </div>

        {/* Vertical Divider */}
        <div className="hidden sm:block w-px self-stretch bg-slate-200" />

        {/* Right Side: Exact Profile Details */}
        <div className="flex-1 w-full space-y-4">
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-[#0f2757] tracking-tight">
              {name}
            </h3>
            <p className="text-sm sm:text-base font-semibold text-slate-600 mt-0.5">
              {designation}
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {/* Email Row */}
            <div className="flex items-center gap-3 text-sm sm:text-base">
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <span className="font-bold text-slate-900 min-w-[55px]">Email :</span>
              <a
                href={`mailto:${email}`}
                className="font-medium text-slate-700 hover:text-blue-600 transition-colors truncate"
              >
                {email}
              </a>
            </div>

            {/* Office Row */}
            <div className="flex items-center gap-3 text-sm sm:text-base">
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="font-bold text-slate-900 min-w-[55px]">Office :</span>
              <span className="font-medium text-slate-700">
                {office}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
