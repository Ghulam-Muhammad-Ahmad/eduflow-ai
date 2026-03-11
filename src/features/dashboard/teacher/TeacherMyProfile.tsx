"use client";

import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTutorContract } from "@/hooks/useTutorContract";
import { ArrowLeft, User, Camera } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function TeacherMyProfile() {
  const { user, profile, updateBio, updateAvatar } = useAuth();
  const { contract, refetch: refetchContract } = useTutorContract();
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [subjects, setSubjects] = useState(
    contract?.subjects?.length ? (contract.subjects as string[]).join(", ") : ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBio(profile?.bio ?? "");
  }, [profile?.bio]);

  useEffect(() => {
    setSubjects(contract?.subjects?.length ? (contract.subjects as string[]).join(", ") : "");
  }, [contract?.subjects]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error: bioError } = await updateBio(bio.trim() || null);
      if (bioError) {
        toast.error("Failed to save bio");
        return;
      }
      if (contract) {
        const subjectsList = subjects
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
        const { error: subError } = await supabase
          .from("tutor_contracts")
          .update({ subjects: subjectsList, updated_at: new Date().toISOString() })
          .eq("id", contract.id);
        if (subError) {
          toast.error("Failed to save subjects");
          return;
        }
        void refetchContract();
      }
      toast.success("Profile saved");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, or WEBP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB.");
      return;
    }
    setAvatarUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const { error: profileError } = await updateAvatar(data.publicUrl);
      if (profileError) {
        toast.error(profileError.message);
        return;
      }
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error((err as Error)?.message ?? "Failed to upload photo");
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/teacher">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold">My profile</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            This profile is visible to the workspace owner and to students. Keep your description and subjects up to
            date.
          </p>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex items-start gap-6">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="text-2xl">
                    {(profile?.display_name ?? user?.email ?? "T")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                >
                  {avatarUploading ? (
                    <Spinner size="sm" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <Label htmlFor="bio">Description / bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="A short description of your teaching experience and approach..."
                    rows={4}
                    className="mt-2"
                  />
                </div>
                {contract && (
                  <div>
                    <Label htmlFor="subjects">Subjects (comma-separated)</Label>
                    <Input
                      id="subjects"
                      value={subjects}
                      onChange={(e) => setSubjects(e.target.value)}
                      placeholder="Math, English, Science"
                      className="mt-2"
                    />
                  </div>
                )}
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving…
                </>
              ) : (
                "Save profile"
              )}
            </Button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
