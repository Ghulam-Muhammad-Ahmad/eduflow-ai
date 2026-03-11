import { useState } from "react";
import { useJoinClassroom } from "@/hooks/useClassrooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface JoinClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const JoinClassroomDialog = ({ open, onOpenChange }: JoinClassroomDialogProps) => {
  const [joinCode, setJoinCode] = useState("");
  const joinClassroom = useJoinClassroom();

  const handleJoin = async () => {
    if (!joinCode.trim()) return;

    try {
      await joinClassroom.mutateAsync(joinCode.trim());
      setJoinCode("");
      onOpenChange(false);
    } catch {
      // Error handled by the hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && joinCode.trim()) {
      handleJoin();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-4 feature-icon-indigo">
            <Users className="w-6 h-6" />
          </div>
          <DialogTitle className="text-center">Join a Classroom</DialogTitle>
          <DialogDescription className="text-center">
            Enter the 6-character code provided by your tutor to join their
            classroom.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6">
          <Input
            placeholder="Enter classroom code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            className="text-center text-2xl font-mono tracking-[0.5em] uppercase h-14"
            maxLength={6}
            autoFocus
          />
          <p className="text-xs text-muted-foreground text-center mt-2">
            Example: ABC123
          </p>
        </div>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleJoin}
            disabled={joinCode.length !== 6 || joinClassroom.isPending}
            className="gap-2"
          >
            {joinClassroom.isPending ? (
              <>
                <Spinner size="sm" />
                Joining...
              </>
            ) : (
              "Join Classroom"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JoinClassroomDialog;
