'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface DualRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  className?: string;
}

export function DualRangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  className,
}: DualRangeSliderProps) {
  const [minValue, setMinValue] = useState(value[0]);
  const [maxValue, setMaxValue] = useState(value[1]);

  useEffect(() => {
    setMinValue(value[0]);
    setMaxValue(value[1]);
  }, [value]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = parseInt(e.target.value);
    if (newMin <= maxValue) {
      setMinValue(newMin);
      onValueChange([newMin, maxValue]);
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = parseInt(e.target.value);
    if (newMax >= minValue) {
      setMaxValue(newMax);
      onValueChange([minValue, newMax]);
    }
  };

  // Calculate percentages for positioning
  const minPercent = ((minValue - min) / (max - min)) * 100;
  const maxPercent = ((maxValue - min) / (max - min)) * 100;

  return (
    <div className={cn('w-full', className)}>
      <div className="relative h-8 flex items-center">
        {/* Track background */}
        <div className="absolute w-full h-1 bg-muted rounded-full top-1/2 transform -translate-y-1/2" />

        {/* Active range track */}
        <div
          className="absolute h-1 bg-primary rounded-full top-1/2 transform -translate-y-1/2 pointer-events-none"
          style={{
            left: `${minPercent}%`,
            right: `${100 - maxPercent}%`,
          }}
        />

        {/* Min input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={minValue}
          onChange={handleMinChange}
          className={cn(
            'absolute w-full h-2 pointer-events-none appearance-none bg-transparent rounded-full outline-none',
            'z-10',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5',
            '[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2',
            '[&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto',
            '[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:hover:shadow-md',
            '[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5',
            '[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2',
            '[&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto',
            '[&::-moz-range-thumb]:shadow-sm',
          )}
        />

        {/* Max input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxValue}
          onChange={handleMaxChange}
          className={cn(
            'absolute w-full h-2 pointer-events-none appearance-none bg-transparent rounded-full outline-none',
            'z-5',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5',
            '[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2',
            '[&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto',
            '[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:hover:shadow-md',
            '[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5',
            '[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2',
            '[&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto',
            '[&::-moz-range-thumb]:shadow-sm',
          )}
        />
      </div>
    </div>
  );
}
