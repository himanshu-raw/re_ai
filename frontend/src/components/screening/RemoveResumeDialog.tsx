"use client";

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

interface RemoveResumeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  label: string;
  isBulk: boolean;
  isRemoving: boolean;
}

export function RemoveResumeDialog({ isOpen, onOpenChange, onConfirm, label, isBulk, isRemoving }: RemoveResumeDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={!isRemoving ? onOpenChange : undefined}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {isBulk ? "these resumes" : "this resume"} from Overview?</AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk ? "These resumes" : label} will be hidden from the Overview list and remain available in Candidates and Compare.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault(); // prevent default dialog close
              onConfirm();
            }} 
            disabled={isRemoving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isRemoving ? "Removing..." : "Remove from Overview"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
