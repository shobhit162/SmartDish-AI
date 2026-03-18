"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FOOD_MODE_COOKIE, FOOD_MODES, normalizeFoodMode } from "@/lib/food-mode";

export default function FoodModeSwitch({ initialMode = FOOD_MODES.NON_VEG }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState(() => normalizeFoodMode(initialMode));

  const updateMode = (nextMode) => {
    const normalized = normalizeFoodMode(nextMode);
    setMode(normalized);
    document.cookie = `${FOOD_MODE_COOKIE}=${normalized}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.dispatchEvent(
      new CustomEvent("food-mode-changed", {
        detail: { mode: normalized },
      })
    );
    startTransition(() => {
      router.refresh();
    });
  };

  const base =
    "h-8 px-3 text-xs font-semibold rounded-full border transition-colors disabled:opacity-70";

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1">
      <button
        type="button"
        onClick={() => updateMode(FOOD_MODES.VEG)}
        disabled={isPending}
        className={`${base} ${
          mode === FOOD_MODES.VEG
            ? "bg-green-600 text-white border-green-600"
            : "bg-transparent text-stone-600 border-transparent hover:bg-stone-100"
        }`}
      >
        Veg
      </button>
      <button
        type="button"
        onClick={() => updateMode(FOOD_MODES.NON_VEG)}
        disabled={isPending}
        className={`${base} ${
          mode === FOOD_MODES.NON_VEG
            ? "bg-orange-600 text-white border-orange-600"
            : "bg-transparent text-stone-600 border-transparent hover:bg-stone-100"
        }`}
      >
        Non-Veg
      </button>
    </div>
  );
}
