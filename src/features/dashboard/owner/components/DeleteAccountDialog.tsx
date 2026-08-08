import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const CONFIRM_WORD = "DELETE";

export interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** auth user id of the tutor/student to remove. */
  userId: string;
  displayName: string;
  accountType: "tutor" | "student";
  onDeleted?: () => void;
}

/**
 * Owner-only, irreversible account deletion. The typed confirmation is deliberate: the
 * server cascades the delete across every table that references the user, so there is no
 * undo once this goes through.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  userId,
  displayName,
  accountType,
  onDeleted,
}: DeleteAccountDialogProps) {
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const close = (next: boolean) => {
    if (deleting) return;
    if (!next) setConfirmText("");
    onOpenChange(next);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/tenant/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((json as { error?: string }).error ?? "Failed to delete account");
        return;
      }
      toast.success(
        accountType === "tutor" ? "Tutor account deleted" : "Student account deleted"
      );
      // The owner workspace hook keys all start with "owner-workspace".
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("owner-workspace"),
      });
      setConfirmText("");
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {displayName}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This permanently deletes the {accountType} account and everything attached to
                it — profile, classroom enrolments, 1v1 rooms,{" "}
                {accountType === "tutor"
                  ? "assignments, quizzes, contracts and uploaded documents"
                  : "submissions, quiz attempts and uploaded documents"}
                . They will no longer be able to sign in.
              </p>
              <p className="font-medium text-destructive">This cannot be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="delete-confirm">
            Type <span className="font-mono font-semibold">{CONFIRM_WORD}</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleting || confirmText.trim() !== CONFIRM_WORD}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Deleting..." : "Delete account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteAccountDialog;
