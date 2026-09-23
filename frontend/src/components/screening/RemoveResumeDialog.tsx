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
          <AlertDialogTitle>Remove {isBulk ? "these resumes" : "this resume"}?</AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk ? "These resumes" : label} and {isBulk ? "their" : "its"} extracted skills, scores, and evidence will be permanently deleted.
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
            {isRemoving ? "Removing..." : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
