import { User } from "lucide-react";
import type { DeanDetails } from "@/lib/local-homepage-store";

interface DeanDetailsCardProps {
  dean: DeanDetails;
}

export function DeanDetailsCard({ dean }: DeanDetailsCardProps) {
  const fields = [
    { label: "Name", value: dean.name || "Dr. K. Rama Linga Reddy" },
    { label: "Designation", value: dean.designation || "Dean, Student Affairs & Professor" },
    { label: "Email", value: dean.email || "dean.studentaffairs@gnits.ac.in" },
    { label: "Contact", value: dean.contact_number || "+91 040-23565648 / 9849000000" },
  ];

  return (
    <div className="w-full rounded-3xl bg-white/95 backdrop-blur-md p-6 sm:p-7 border border-white/80 shadow-xl mt-6 sm:mt-8">
      {/* Top Header: User Icon + "Dean Details" */}
      <div className="flex items-center gap-2.5 pb-5 border-b border-slate-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f172a] text-white">
          <User className="h-5 w-5 stroke-[2.5]" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-[#0f172a] tracking-tight">
          Dean Details
        </h3>
      </div>

      {/* Main Content Layout */}
      <div className="pt-6 flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
        {/* Left Side: Dean Photo Container */}
        <div className="flex-shrink-0">
          <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl bg-[#dbeafe] border-2 border-[#bfdbfe] shadow-inner flex items-center justify-center overflow-hidden">
            {dean.profile_photo ? (
              <img
                src={dean.profile_photo}
                alt={dean.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-[#3b82f6]">
                <div className="h-12 w-12 rounded-full bg-[#3b82f6] mb-1" />
                <div className="h-8 w-18 rounded-t-full bg-[#3b82f6]" />
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Aligned Information Rows with Colons and Underlines */}
        <div className="flex-1 w-full space-y-3.5 sm:space-y-4">
          {fields.map((field) => (
            <div key={field.label} className="w-full">
              <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                {/* Field Label */}
                <span className="w-24 sm:w-28 font-bold text-slate-800 flex-shrink-0">
                  {field.label}
                </span>

                {/* Colon */}
                <span className="font-bold text-slate-800 flex-shrink-0">:</span>

                {/* Field Value */}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-900 tracking-wide break-words">
                    {field.value}
                  </span>
                </div>
              </div>

              {/* Clean Underline Line matching the design */}
              <div className="mt-1 h-px w-full bg-slate-300/80" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
