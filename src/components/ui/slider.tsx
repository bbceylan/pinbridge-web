import * as React from 'react';

import { cn } from '@/lib/utils';

export interface SliderProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      className,
      value,
      defaultValue,
      min = 0,
      max = 100,
      step = 1,
      onValueChange,
      ...props
    },
    ref
  ) => {
    const values = value ?? defaultValue ?? [min];

    return (
      <div ref={ref} className={cn('flex w-full items-center gap-3', className)} {...props}>
        {values.map((currentValue, index) => (
          <input
            key={index}
            type="range"
            min={min}
            max={max}
            step={step}
            value={currentValue}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              const nextValues = [...values];
              nextValues[index] = nextValue;
              onValueChange?.(nextValues);
            }}
            className="w-full accent-current"
          />
        ))}
      </div>
    );
  }
);

Slider.displayName = 'Slider';
