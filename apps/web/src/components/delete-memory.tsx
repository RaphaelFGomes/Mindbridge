'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? 'Deleting…' : 'Delete memory'}
    </Button>
  );
}

interface DeleteMemoryProps {
  name: string;
  action: () => Promise<void>;
}

export function DeleteMemory({ name, action }: DeleteMemoryProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        title="Delete this memory?"
        description={`"${name}" will be gone for every assistant. This cannot be undone.`}
      >
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <form action={action}>
          <ConfirmButton />
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
