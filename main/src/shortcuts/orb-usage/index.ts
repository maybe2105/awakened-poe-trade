import { uIOhook, UiohookKey as Key } from "uiohook-napi";
import { OverlayWindow } from "../../windowing/OverlayWindow";
import type { OcrWorker } from "../../vision/link-main";
import type {
  OrbUsageOptions,
  ProcessOptions,
  ItemProcessResult,
  UseOrbOnStashOptions,
  AnalyzeStashOptions,
} from "./types";
import { cleanupStopMechanisms } from "./state";
import { processStashItems } from "./stash-processor";
import { processItemAtCursor } from "./cursor-processor";

/**
 * High-level function: Use orb on entire stash - SIMPLIFIED
 */
export async function useOrbOnStash(
  orbPosition: { x: number; y: number },
  ocrWorker: OcrWorker,
  overlay: OverlayWindow,
  options: UseOrbOnStashOptions = {}
): Promise<ItemProcessResult[]> {
  try {
    const results = await processStashItems(ocrWorker, overlay, {
      ...options,
      useOrb: true,
      onRoundComplete: (round) => {
        if (options.onRoundComplete) {
          options.onRoundComplete(round);
        }
      },
      onComplete: () => {
        // console.log(`Completed all rounds: Used orb ${totalProcessed} total items`);
      },
    });
    return results;
  } finally {
    cleanupOrbUsage();
  }
}

/**
 * Analysis only: Check all stash items - SIMPLIFIED
 */
export async function analyzeStash(
  ocrWorker: OcrWorker,
  overlay: OverlayWindow,
  options: AnalyzeStashOptions = {}
): Promise<ItemProcessResult[]> {
  return processStashItems(ocrWorker, overlay, {
    ...options,
    useOrb: false,
  });
}

export const useOrbOnMouse = async (
  options: ProcessOptions,
  ocrWorker: OcrWorker,
  overlay: OverlayWindow
) => {
  const res = await processItemAtCursor(ocrWorker, overlay, options);
  return res;
};

export const cleanupOrbUsage = () => {
  uIOhook.keyToggle(Key.Shift, "up");
  cleanupStopMechanisms();
};

// Re-export core functions for direct access
export { processItemAtCursor } from "./cursor-processor";
export { processStashItems } from "./stash-processor";
export { processItem } from "./processor";

// Re-export types
export type {
  OrbUsageOptions,
  ProcessOptions,
  ItemProcessResult,
  UseOrbOnStashOptions,
  AnalyzeStashOptions,
} from "./types";

export { FLAG } from "./state";
