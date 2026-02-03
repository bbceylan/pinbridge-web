'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Crown } from 'lucide-react';

interface PremiumUpsellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  ctaLabel?: string;
}

export function PremiumUpsellDialog({
  open,
  onOpenChange,
  title = 'Automated Transfer is Premium',
  description = 'Start your 7-day free trial to unlock smart matching, bulk verification, and faster transfers.',
  ctaLabel = 'Start Free Trial',
}: PremiumUpsellDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-start">
          <Button
            onClick={() => {
              onOpenChange(false);
              router.push('/premium');
            }}
          >
            {ctaLabel}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
