import * as React from 'react';

import { cn } from '@/lib/utils';

interface PopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({ children, ...props }: PopoverProps) {
  const { open: _open, onOpenChange: _onOpenChange, ...rest } = props;
  return <div {...rest}>{children}</div>;
}

export interface PopoverTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

export const PopoverTrigger = React.forwardRef<HTMLElement, PopoverTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, { ...props, ref } as any);
    }

    return (
      <button ref={ref as any} type="button" {...props}>
        {children}
      </button>
    );
  }
);

PopoverTrigger.displayName = 'PopoverTrigger';

export const PopoverContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'z-50 rounded-md border bg-popover p-4 text-popover-foreground shadow-md',
          className
        )}
        {...props}
      />
    );
  }
);

PopoverContent.displayName = 'PopoverContent';
