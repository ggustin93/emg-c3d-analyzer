import React from 'react';
import { Badge } from './badge';
import { LockClosedIcon, PersonIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

type CommonProps = {
  className?: string;
};

export function LockedBadge({ className }: CommonProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs bg-slate-100 text-slate-700 border border-slate-300',
        'inline-flex items-center',
        className,
      )}
    >
      <LockClosedIcon className="h-3 w-3 mr-1" />
      Locked
    </Badge>
  );
}

export function SourceStatusBadge({ source, ok, className }: { source: string; ok: boolean } & CommonProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs border',
        ok ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300',
        className,
      )}
    >
      {source} {ok ? '✓' : '×'}
    </Badge>
  );
}

export function TherapistBadge({ className }: CommonProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs bg-blue-100 text-blue-800 border-blue-300',
        'inline-flex items-center',
        className,
      )}
    >
      <PersonIcon className="h-3 w-3 mr-1" />
      Therapist
    </Badge>
  );
}

export default {
  LockedBadge,
  SourceStatusBadge,
  TherapistBadge,
};


