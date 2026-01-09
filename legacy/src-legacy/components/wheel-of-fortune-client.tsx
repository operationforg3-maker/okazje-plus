"use client";

import { WheelOfFortune } from "@/components/wheel-of-fortune";
import { WheelPrize } from "@/lib/types";

interface WheelOfFortuneClientProps {
  prizes: WheelPrize[];
  pageId: string;
  requiresAuth: boolean;
}

export function WheelOfFortuneClient({
  prizes,
  pageId,
  requiresAuth,
}: WheelOfFortuneClientProps) {
  const handleSpinComplete = async (prize: WheelPrize) => {
    try {
      // Record spin
      await fetch("/api/secret-pages/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          prizeId: prize.id,
          prizeLabel: prize.label,
        }),
      });

      // Redirect if prize has link
      if (prize.link) {
        setTimeout(() => {
          window.location.href = prize.link!;
        }, 3000);
      }
    } catch (error) {
      console.error("Failed to record spin:", error);
    }
  };

  return (
    <WheelOfFortune
      prizes={prizes}
      onSpinComplete={handleSpinComplete}
      spinButtonText="Zakręć kołem fortuny!"
    />
  );
}
