// This is a temporary file to help TypeScript recognize the lucide-react module
// If the actual types from the package start working, this file can be deleted

declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';
  
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
  }
  
  // Define the icons imported in game-session-tabs.tsx
  export const Clock: FC<IconProps>;
  export const Activity: FC<IconProps>;
  export const Dumbbell: FC<IconProps>;
  export const Award: FC<IconProps>;
  export const Zap: FC<IconProps>;
  export const ChevronsLeftRight: FC<IconProps>;
  
  // Add other icons as needed
} 