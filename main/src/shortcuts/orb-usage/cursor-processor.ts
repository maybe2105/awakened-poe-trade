import { uIOhook, UiohookKey as Key } from "uiohook-napi";
import { mouse } from "@nut-tree-fork/nut-js";
import { OverlayWindow } from "../../windowing/OverlayWindow";
import type { OcrWorker } from "../../vision/link-main";
import type { ProcessOptions, ItemProcessResult } from "./types";
import { getRandomTimeout } from "./utils";
import { initializeStopMechanisms, cleanupStopMechanisms, shouldStop, FLAG } from "./state";
import { processItem } from "./processor";
import { Logger } from "../../RemoteLogger";

/**
 * Process item at current mouse cursor position
 */
export async function processItemAtCursor(
  ocrWorker: OcrWorker,
  overlay: OverlayWindow,
  options: ProcessOptions = {},
  logger: Logger
): Promise<ItemProcessResult | null> {
  overlay.assertGameActive();
  const { maxAttempts = 1, delayBetweenItems = 150 } = options;

  // Initialize stopping mechanisms for single item
  const cleanup = await initializeStopMechanisms();

  uIOhook.keyToggle(Key.Shift, "down");

  console.log("Processing item at cursor", {
    customColorThreshold: options.customColorThresholds,
  });

  try {
    const currentPos = await mouse.getPosition();
    // No screenshot parameter - will capture its own
    for (let i = 0; i < maxAttempts && !(await shouldStop()); i++) {
      const result = await processItem(
        currentPos.x,
        currentPos.y,
        ocrWorker,
        overlay,
        options,
        null, // screenshot
        logger
      );
      if (result.isMatched) {
        return result;
      }
      if (delayBetweenItems > 0 && i < maxAttempts - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, getRandomTimeout(delayBetweenItems, 0.25))
        );
      }
    }
    return null;
  } finally {
    cleanup();
    uIOhook.keyToggle(Key.Shift, "up");
    cleanupStopMechanisms();
  }
}
