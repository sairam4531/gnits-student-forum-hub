import { useState } from "react";
import {
  User,
  Mail,
  Phone,
  Building2,
  Check,
  Copy,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import type { DeanDetails } from "@/lib/local-homepage-store";

interface DeanDetailsCardProps {
  dean: DeanDetails;
  onOpenEventsDrawer?: () => void;
}

export function DeanDetailsCard({ dean, onOpenEventsDrawer }: DeanDetailsCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const name = dean.name || "Dr. K. Rama Linga Reddy";
  const designation = dean.designation || "Dean, Student Affairs & Professor";
  const email = dean.email || "dean.studentaffairs@gnits.ac.in";
  const contact = dean.contact_number || "+91 040-23565648 / +91 9849000000";

  return (
    <div className="w-full">
      {/* Boxless Section Header */}
      <div className="mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[#2563eb] text-xs font-bold uppercase tracking-wider mb-3">
          <ShieldCheck className="h-4 w-4 text-[#2563eb]" />
          <span>Directorate of Student Affairs &bull; Verified Office</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
          Dean's Profile &amp; Directorate
        </h2>
        <p className="text-sm sm:text-base text-slate-600 mt-1 max-w-2xl font-medium">
          G. Narayanamma Institute of Technology &amp; Science (Autonomous, For Women)
        </p>
      </div>

      {/* Main Content Layout - Pure Open Layout (NO BOXES) */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 sm:gap-12 lg:gap-16">
        {/* Left Side: Portrait Photo (Open presentation, no box) */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className="relative p-1 rounded-3xl bg-gradient-to-br from-[#2563eb] via-amber-400 to-[#1e3a8a] shadow-lg">
            <div className="h-44 w-44 sm:h-52 sm:w-52 rounded-[22px] bg-slate-100 overflow-hidden flex items-center justify-center border-2 border-white">
              {dean.profile_photo ? (
                <img
                  src={dean.profile_photo}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-[#2563eb] w-full h-full bg-[#eff6ff]">
                  <div className="h-20 w-20 rounded-full bg-[#2563eb]/20 flex items-center justify-center mb-2">
                    <User className="h-12 w-12 text-[#2563eb]" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Dean's Portrait
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3.5 inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Administration</span>
          </div>
        </div>

        {/* Right Side: Information with Aligned Labels & Lines (NO BOXES) */}
        <div className="flex-1 w-full space-y-6">
          {/* Header info */}
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-md border border-amber-200 inline-block mb-2">
              Institutional Leadership
            </span>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              {name}
            </h3>
            <p className="text-base sm:text-xl font-bold text-[#2563eb] mt-1">
              {designation}
            </p>
          </div>

          {/* Details Rows with Aligned Colons and Underlines (matching sketch, completely box-free) */}
          <div className="space-y-4 pt-2">
            {/* Name Row */}
            <div className="group">
              <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                <span className="w-28 sm:w-32 font-bold text-slate-600 flex-shrink-0">
                  Name
                </span>
                <span className="font-bold text-slate-700 flex-shrink-0">:</span>
                <span className="font-extrabold text-slate-900 truncate">
                  {name}
                </span>
              </div>
              <div className="mt-2 h-px w-full bg-slate-200" />
            </div>

            {/* Designation Row */}
            <div className="group">
              <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                <span className="w-28 sm:w-32 font-bold text-slate-600 flex-shrink-0">
                  Designation
                </span>
                <span className="font-bold text-slate-700 flex-shrink-0">:</span>
                <span className="font-bold text-[#2563eb] truncate">
                  {designation}
                </span>
              </div>
              <div className="mt-2 h-px w-full bg-slate-200" />
            </div>

            {/* Email Row */}
            <div className="group">
              <div className="flex items-center justify-between gap-2 text-sm sm:text-base">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <span className="w-28 sm:w-32 font-bold text-slate-600 flex-shrink-0 flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-[#2563eb]" />
                    <span>Email</span>
                  </span>
                  <span className="font-bold text-slate-700 flex-shrink-0">:</span>
                  <a
                    href={`mailto:${email}`}
                    className="font-bold text-slate-900 hover:text-[#2563eb] underline-offset-4 hover:underline truncate"
                  >
                    {email}
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(email, "email")}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Copy email"
                >
                  {copiedField === "email" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="mt-2 h-px w-full bg-slate-200" />
            </div>

            {/* Contact Row */}
            <div className="group">
              <div className="flex items-center justify-between gap-2 text-sm sm:text-base">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <span className="w-28 sm:w-32 font-bold text-slate-600 flex-shrink-0 flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-[#2563eb]" />
                    <span>Contact</span>
                  </span>
                  <span className="font-bold text-slate-700 flex-shrink-0">:</span>
                  <a
                    href={`tel:${contact.split("/")[0]?.trim() || contact}`}
                    className="font-bold text-slate-900 hover:text-[#2563eb] truncate"
                  >
                    {contact}
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(contact, "contact")}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Copy contact number"
                >
                  {copiedField === "contact" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="mt-2 h-px w-full bg-slate-200" />
            </div>

            {/* Office Location Row */}
            <div className="group">
              <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                <span className="w-28 sm:w-32 font-bold text-slate-600 flex-shrink-0 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-[#2563eb]" />
                  <span>Office</span>
                </span>
                <span className="font-bold text-slate-700 flex-shrink-0">:</span>
                <span className="font-semibold text-slate-800">
                  Directorate of Student Affairs, Admin Block, GNITS Campus
                </span>
              </div>
              <div className="mt-2 h-px w-full bg-slate-200" />
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="pt-4 flex flex-wrap gap-4">
            <a
              href={`mailto:${email}?subject=Student%20Affairs%20Query`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all"
            >
              <Mail className="h-4 w-4" />
              <span>Email Dean's Office</span>
            </a>

            {onOpenEventsDrawer && (
              <button
                type="button"
                onClick={onOpenEventsDrawer}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Calendar className="h-4 w-4 text-amber-400" />
                <span>Explore Student Clubs &amp; Submit Event</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
