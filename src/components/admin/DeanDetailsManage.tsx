import { useState, useRef } from "react";
import { User, Upload, Check, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { updateDeanDetailsAdminServerFn } from "@/lib/homepage.functions";
import type { DeanDetails } from "@/lib/local-homepage-store";
import { DeanDetailsCard } from "@/components/DeanDetailsCard";

interface DeanDetailsManageProps {
  dean: DeanDetails;
  onRefresh: () => Promise<void>;
}

export function DeanDetailsManage({ dean, onRefresh }: DeanDetailsManageProps) {
  const [name, setName] = useState(dean.name);
  const [designation, setDesignation] = useState(dean.designation);
  const [email, setEmail] = useState(dean.email);
  const [contactNumber, setContactNumber] = useState(dean.contact_number);
  const [profilePhoto, setProfilePhoto] = useState(dean.profile_photo || "");

  // Photo upload
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    setPhotoFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setPhotoBase64(b64);
      setProfilePhoto(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSaving(true);

    try {
      await updateDeanDetailsAdminServerFn({
        data: {
          name: name.trim(),
          designation: designation.trim(),
          email: email.trim(),
          contact_number: contactNumber.trim(),
          profile_photo: profilePhoto || undefined,
          photoBase64: photoBase64 || undefined,
          photoFileName: photoFileName || undefined,
        },
      });

      await onRefresh();
      setSuccessMsg("Dean Details successfully updated and published to the homepage!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update Dean details.");
    } finally {
      setSaving(false);
    }
  };

  // Preview object combining state
  const previewDean: DeanDetails = {
    id: dean.id,
    name,
    designation,
    email,
    contact_number: contactNumber,
    profile_photo: profilePhoto,
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Dean Details Management
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Update the Dean's official name, academic designation, profile photo, and institutional contact details displayed on the homepage.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 text-xs sm:text-sm border border-emerald-200 flex items-center gap-2.5">
          <Check className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 text-rose-800 text-xs sm:text-sm border border-rose-200 flex items-center gap-2.5">
          <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Edit Form (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
            <User className="h-4 w-4 text-[#1e3a8a]" />
            <span>Edit Information</span>
          </h3>

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Dean Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. K. Rama Linga Reddy"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
              />
            </div>

            {/* Designation */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Designation *
              </label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Dean, Student Affairs & Professor"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Official Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dean.studentaffairs@gnits.ac.in"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
              />
            </div>

            {/* Contact Number */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Contact Number *
              </label>
              <input
                type="text"
                required
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+91 040-23565648 / 9849000000"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
              />
            </div>

            {/* Profile Photo Upload */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Dean Profile Photo (Upload or Image URL)
              </label>
              <div className="flex gap-2.5">
                <input
                  type="text"
                  value={profilePhoto}
                  onChange={(e) => setProfilePhoto(e.target.value)}
                  placeholder="https://.../photo.jpg or upload"
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Photo</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handlePhotoSelect(e.target.files[0]);
                    }
                  }}
                />
              </div>
              {photoFileName && (
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                  ✓ Photo chosen: {photoFileName}
                </p>
              )}
            </div>

            {/* Save Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Save & Publish to Homepage</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Live Interactive Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Live Homepage Preview</span>
          </div>
          <p className="text-xs text-slate-500">
            This preview updates in real-time as you type above, demonstrating exactly how the card appears on the student portal.
          </p>

          <DeanDetailsCard dean={previewDean} />
        </div>
      </div>
    </div>
  );
}
