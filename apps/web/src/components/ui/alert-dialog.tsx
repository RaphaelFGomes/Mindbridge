'use client';

import { AlertDialog as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

export const AlertDialog = Primitive.Root;
export const AlertDialogTrigger = Primitive.Trigger;
export const AlertDialogCancel = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Cancel>) => (
  <Primitive.Cancel className={cn(buttonVariants({ variant: 'outline' }), className)} {...props} />
);
export const AlertDialogAction = Primitive.Action;

interface ContentProps extends ComponentProps<typeof Primitive.Content> {
  title: string;
  description: string;
}

/** Modal confirmation: focus is trapped, Escape cancels, title and description are announced. */
export function AlertDialogContent({
  title,
  description,
  children,
  className,
  ...props
}: ContentProps) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 bg-black/40" />
      <Primitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 shadow-lg',
          className,
        )}
        {...props}
      >
        <Primitive.Title className="text-lg font-semibold">{title}</Primitive.Title>
        <Primitive.Description className="text-sm text-muted-foreground">
          {description}
        </Primitive.Description>
        <div className="flex justify-end gap-2">{children}</div>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
