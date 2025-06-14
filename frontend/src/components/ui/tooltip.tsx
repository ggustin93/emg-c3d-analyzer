"use client"

import * as React from "react"

// Simple tooltip implementation that doesn't require @radix-ui/react-tooltip
const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

const Tooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

const TooltipTrigger: React.FC<{ children: React.ReactNode; asChild?: boolean }> = ({ 
  children,
  asChild = false,
}) => {
  return <>{children}</>;
};

interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
  sideOffset?: number;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  TooltipContentProps & React.HTMLAttributes<HTMLDivElement>
>(({ children, className, sideOffset = 4, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
});

TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } 