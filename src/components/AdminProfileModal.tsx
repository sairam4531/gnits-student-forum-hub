import { useState } from "react";
import { User, Image as ImageIcon, CheckCircle2, Loader2, X } from "lucide-react";
import { updateAdminProfileServerFn, type AdminProfileRecord } from "@/lib/admin.functions";

interface AdminProfileModalProps {
  profile: AdminProfileRecord;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (updated: AdminProfileRecord) => void;
}

export function AdminProfileModal({
  profile,
  isOpen,
  onClose,
  onProfileUpdated,
}: AdminProfileModalProps) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!displayName.trim()) {
      setError("Display name cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateAdminProfileServerFn({
        data: {
          display_name: displayName.trim(),
          avatar_url: avatarUrl.trim() ? avatarUrl.trim() : null,
        },
      });
      setSuccess(true);
      onProfileUpdated(updated as AdminProfileRecord);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Admin Profile Settings</h3>
              <p className="text-xs text-muted-foreground">GNITS Student Council Administrator</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-600 font-semibold border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
              Username (Read-only)
            </label>
            <input
              type="text"
              disabled
              value={profile.username}
              className="w-full rounded-xl border border-input bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
              Display Name *
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. GNITS Student Council Admin"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
              Avatar Image URL
            </label>
            <div className="relative">
              <ImageIcon className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="url"
                maxLength={2048}
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition-all disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
