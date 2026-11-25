import { useState, useRef, useEffect } from "react";
import { User, Upload, Check, AlertCircle, Loader2, Sparkles, Mail, Building2 } from "lucide-react";
import { updateDeanDetailsAdminServerFn } from "@/lib/homepage.functions";
import type { DeanDetails } from "@/lib/local-homepage-store";
import { saveClientDeanDetails } from "@/lib/client-portal-store";

interface DeanDetailsManageProps {
  dean: DeanDetails;
  onRefresh: () => Promise<void>;
}

export function DeanDetailsManage({ dean, onRefresh }: DeanDetailsManageProps) {
  const [name, setName] = useState(dean.name);
  const [designation, setDesignation] = useState(dean.designation);
  const [email, setEmail] = useState(dean.email);
  const [office, setOffice] = useState(
    dean.office || dean.contact_number || "Dean – Student Affairs, GNITS, Hyderabad",
  );
  const [profilePhoto, setProfilePhoto] = useState(dean.profile_photo || "");

  useEffect(() => {
    setName(dean.name || "");
    setDesignation(dean.designation || "");
    setEmail(dean.email || "");
    setOffice(
      dean.office || dean.contact_number || "Dean – Student Affairs, GNITS, Hyderabad",
    );
    setProfilePhoto(dean.profile_photo || "");
  }, [dean]);

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
      const rawBase64 = reader.result as string;
      // Optimize image via canvas to keep base64 compact (~50-80KB) for seamless KV persistence
      const img = new Image();
      img.onload = () => {
        const maxDim = 600;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const optimizedB64 = canvas.toDataURL("image/jpeg", 0.85);
          setPhotoBase64(optimizedB64);
          setProfilePhoto(optimizedB64);
        } else {
          setPhotoBase64(rawBase64);
          setProfilePhoto(rawBase64);
        }
      };
      img.onerror = () => {
        setPhotoBase64(rawBase64);
        setProfilePhoto(rawBase64);
      };
      img.src = rawBase64;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSaving(true);

    try {
      // Save authoritatively on the server first so all browsers and deployments receive the update
      const response = await updateDeanDetailsAdminServerFn({
        data: {
          name: name.trim(),
          designation: designation.trim(),
          email: email.trim(),
          office: office.trim(),
          contact_number: office.trim(),
          profile_photo: profilePhoto || undefined,
          photoBase64: photoBase64 || undefined,
          photoFileName: photoFileName || undefined,
        },
      });

      const updatedDean: DeanDetails = response?.dean || {
        id: dean.id || "dean-1",
        name: name.trim(),
        designation: designation.trim(),
        email: email.trim(),
        office: office.trim(),
        contact_number: office.trim(),
        profile_photo: profilePhoto || "",
        updated_at: new Date().toISOString(),
      };

      saveClientDeanDetails(updatedDean);
      setPhotoBase64(null);
      setPhotoFileName(null);
      await onRefresh();
      setSuccessMsg("Dean Details successfully updated and published to the homepage!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update Dean details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Centered Section Title matching Admin Dashboard */}
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-black text-[#0f2757] tracking-tight">
          Dean Details
        </h2>
        <div className="w-14 h-1 bg-[#0f2757] mx-auto mt-2.5 rounded-full" />
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

      {/* Perfectly aligned 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left: Edit Form Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
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
                placeholder="e.g. Dr. Aparna Palle"
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

            {/* Office (Replaces Contact Number) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Office *
              </label>
              <input
                type="text"
                required
                value={office}
                onChange={(e) => setOffice(e.target.value)}
                placeholder="Dean – Student Affairs, GNITS, Hyderabad"
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
                  className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
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
                    <span>Save &amp; Publish to Homepage</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Live Interactive Preview Card with Matching Height & Alignment */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Live Homepage Preview</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Active on Portal
              </span>
            </div>

            {/* Card Preview */}
            <div className="mt-6">
              <div className="text-center mb-6">
                <h4 className="text-xl sm:text-2xl font-black text-[#0f2757] tracking-tight">
                  Dean - Student Affairs Profile
                </h4>
                <div className="w-12 h-1 bg-[#0f2757] mx-auto mt-2 rounded-full" />
              </div>

              <div className="rounded-2xl bg-slate-50/80 border border-slate-200/90 p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5 sm:gap-6 shadow-2xs">
                {/* Photo Frame */}
                <div className="w-32 h-36 sm:w-36 sm:h-40 rounded-xl border border-slate-300 flex flex-col items-center justify-center p-2 bg-white flex-shrink-0 shadow-2xs">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt={name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-1.5">
                        <User className="w-8 h-8 text-slate-400" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">Dean Photo</span>
                    </>
                  )}
                </div>

                <div className="hidden sm:block w-px self-stretch bg-slate-200" />

                {/* Profile Details */}
                <div className="flex-1 w-full space-y-3 min-w-0">
                  <div>
                    <h5 className="text-xl font-black text-[#0f2757] tracking-tight truncate">
                      {name || "Dr. Aparna Palle"}
                    </h5>
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-0.5 truncate">
                      {designation || "Dean, Student Affairs & Professor"}
                    </p>
                  </div>

                  <div className="space-y-2 pt-1 text-xs sm:text-sm">
                    {/* Email Row */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <Mail className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-bold text-slate-900 min-w-[50px]">Email :</span>
                      <span className="font-medium text-slate-700 truncate">{email}</span>
                    </div>

                    {/* Office Row */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-bold text-slate-900 min-w-[50px]">Office :</span>
                      <span className="font-medium text-slate-700 truncate">{office}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-6 text-center">
            This card updates in real-time and reflects on the student homepage immediately when saved.
          </p>
        </div>
      </div>
    </div>
  );
}
