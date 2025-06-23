declare module '@radix-ui/react-slider' {
  import * as React from 'react';
  
  type SliderProps = {
    value?: number[];
    defaultValue?: number[];
    min?: number;
    max?: number;
    step?: number;
    orientation?: 'horizontal' | 'vertical';
    disabled?: boolean;
    minStepsBetweenThumbs?: number;
    onValueChange?: (value: number[]) => void;
    onValueCommit?: (value: number[]) => void;
    name?: string;
    id?: string;
  } & React.ComponentPropsWithoutRef<'span'>;

  const Root: React.ForwardRefExoticComponent<SliderProps & React.RefAttributes<HTMLSpanElement>>;
  const Track: React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'span'> & React.RefAttributes<HTMLSpanElement>>;
  const Range: React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'span'> & React.RefAttributes<HTMLSpanElement>>;
  const Thumb: React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'span'> & React.RefAttributes<HTMLSpanElement>>;

  export {
    Root,
    Track,
    Range,
    Thumb
  };
} 