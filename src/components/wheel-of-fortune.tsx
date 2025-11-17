"use client";

import { useState, useRef, useEffect } from "react";
import { WheelPrize } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface WheelOfFortuneProps {
  prizes: WheelPrize[];
  onSpinComplete: (prize: WheelPrize) => void;
  disabled?: boolean;
  spinButtonText?: string;
}

export function WheelOfFortune({
  prizes,
  onSpinComplete,
  disabled = false,
  spinButtonText = "Zakręć kołem!",
}: WheelOfFortuneProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedPrize, setSelectedPrize] = useState<WheelPrize | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate total probability
  const totalProbability = prizes.reduce(
    (sum, prize) => sum + prize.probability,
    0
  );

  // Draw the wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let currentAngle = rotation;

    prizes.forEach((prize, index) => {
      const sliceAngle =
        (prize.probability / totalProbability) * 2 * Math.PI;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();

      // Color
      const color =
        prize.color || `hsl(${(index * 360) / prizes.length}, 70%, 60%)`;
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(currentAngle + sliceAngle / 2);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px Arial";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;

      const text = `${prize.icon || ""} ${prize.label}`;
      ctx.fillText(text, radius * 0.65, 5);
      ctx.restore();

      currentAngle += sliceAngle;
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw pointer (triangle at top)
    ctx.beginPath();
    ctx.moveTo(centerX, 10);
    ctx.lineTo(centerX - 15, 35);
    ctx.lineTo(centerX + 15, 35);
    ctx.closePath();
    ctx.fillStyle = "#ff4444";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [prizes, rotation, totalProbability]);

  const selectPrize = (): WheelPrize => {
    const random = Math.random() * totalProbability;
    let cumulative = 0;

    for (const prize of prizes) {
      cumulative += prize.probability;
      if (random <= cumulative) {
        return prize;
      }
    }

    return prizes[prizes.length - 1];
  };

  const spinWheel = () => {
    if (isSpinning || disabled) return;

    setIsSpinning(true);
    setSelectedPrize(null);

    const prize = selectPrize();
    const prizeIndex = prizes.indexOf(prize);

    // Calculate target angle
    let targetAngle = 0;
    for (let i = 0; i < prizeIndex; i++) {
      targetAngle += (prizes[i].probability / totalProbability) * 360;
    }
    targetAngle += ((prizes[prizeIndex].probability / totalProbability) * 360) / 2;

    // Add extra rotations for effect (5-7 full rotations)
    const extraRotations = 5 + Math.random() * 2;
    const finalRotation = extraRotations * 360 + (360 - targetAngle);

    // Animate
    const startTime = Date.now();
    const duration = 3000; // 3 seconds

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const currentRotation = (finalRotation * easeOut * Math.PI) / 180;
      setRotation(currentRotation);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        setSelectedPrize(prize);
        onSpinComplete(prize);
      }
    };

    animate();
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="drop-shadow-2xl"
        />
        {isSpinning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Sparkles className="w-12 h-12 text-yellow-400 animate-pulse" />
          </div>
        )}
      </div>

      <Button
        onClick={spinWheel}
        disabled={disabled || isSpinning}
        size="lg"
        className="text-lg px-8 py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
      >
        {isSpinning ? "Kręci się..." : spinButtonText}
      </Button>

      {selectedPrize && !isSpinning && (
        <div className="mt-4 p-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-xl animate-bounce">
          <p className="text-2xl font-bold text-white text-center">
            {selectedPrize.icon} Wygrałeś: {selectedPrize.label}!
          </p>
          {selectedPrize.description && (
            <p className="text-white/90 text-center mt-2">
              {selectedPrize.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
