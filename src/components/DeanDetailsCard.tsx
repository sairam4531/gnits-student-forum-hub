import { useState } from "react";
import {
  User,
  Mail,
  Phone,
  Building2,
  Check,
  Copy,
  ExternalLink,
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
  const contact = dean.contact_number || "+91 040-23565648 / 9849000000";

  return (
    <div className="w-full rounded-3xl bg-white border border-slate-200/90 shadow-xl overflow-hidden mt-8 transition-all hover:shadow-2xl">
      {/* Top Accent Header Bar */}
      <div className="bg-gradient-to-r from-[#1e40af] via-[#2563eb] to-[#1d4ed8] px-6 sm:px-8 py-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 text-white">
            <User className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-blue-200 block">
              G. Narayanamma Institute of Technology &amp; Science
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug">
              Dean's Profile &amp; Directorate of Student Affairs
            </h2>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold border border-white/20">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <span>Verified Office</span>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="p-6 sm:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-10">
        {/* Left Side: Large Portrait Photo Frame with Gold & Royal Blue Ring */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className="relative p-1 rounded-3xl bg-gradient-to-br from-[#2563eb] via-amber-400 to-[#1e3a8a] shadow-xl">
            <div className="h-36 w-36 sm:h-44 sm:w-44 rounded-[22px] bg-slate-100 overflow-hidden flex items-center justify-center border-2 border-white">
              {dean.profile_photo ? (
                <img
                  src={dean.profile_photo}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-[#2563eb] w-full h-full bg-[#eff6ff]">
                  <div className="h-16 w-16 rounded-full bg-[#2563eb]/20 flex items-center justify-center mb-2">
                    <User className="h-10 w-10 text-[#2563eb]" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Dean's Portrait
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Active Administration</span>
          </div>
        </div>

        {/* Right Side: Profile Information & Institutional Contacts */}
        <div className="flex-1 w-full space-y-5">
          {/* Dean Title & Designation */}
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200 inline-block mb-1.5">
              Leadership
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {name}
            </h3>
            <p className="text-base sm:text-lg font-bold text-[#2563eb] mt-0.5">
              {designation}
            </p>
          </div>

          {/* Details Rows with Aligned Colons and Underlines matching sketch */}
          <div className="space-y-3.5 pt-2">
            {/* Email */}
            <div className="group">
              <div className="flex items-center justify-between gap-2 text-sm sm:text-base">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <Mail className="h-4 w-4 text-[#2563eb] flex-shrink-0" />
                  <span className="w-24 sm:w-28 font-bold text-slate-700 flex-shrink-0">
                    Email
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
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Copy email"
                >
                  {copiedField === "email" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="mt-1 h-px w-full bg-slate-200" />
            </div>

            {/* Contact */}
            <div className="group">
              <div className="flex items-center justify-between gap-2 text-sm sm:text-base">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <Phone className="h-4 w-4 text-[#2563eb] flex-shrink-0" />
                  <span className="w-24 sm:w-28 font-bold text-slate-700 flex-shrink-0">
                    Contact
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
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Copy phone number"
                >
                  {copiedField === "contact" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="mt-1 h-px w-full bg-slate-200" />
            </div>

            {/* Office Location */}
            <div className="group">
              <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                <Building2 className="h-4 w-4 text-[#2563eb] flex-shrink-0" />
                <span className="w-24 sm:w-28 font-bold text-slate-700 flex-shrink-0">
                  Office
                </span>
                <span className="font-bold text-slate-700 flex-shrink-0">:</span>
                <span className="font-semibold text-slate-800 truncate">
                  Directorate of Student Affairs, Admin Block, GNITS Campus
                </span>
              </div>
              <div className="mt-1 h-px w-full bg-slate-200" />
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="pt-3 flex flex-wrap gap-3">
            <a
              href={`mailto:${email}?subject=Student%20Affairs%20Query`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all"
            >
              <Mail className="h-4 w-4" />
              <span>Email Dean's Office</span>
            </a>

            {onOpenEventsDrawer && (
              <button
                type="button"
                onClick={onOpenEventsDrawer}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
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
