import type { OcrWorker } from "../../vision/link-main";

export interface OrbUsageOptions {
  orbType: string;
  skipPattern?: string | RegExp;
  maxAttempts?: number;
  delayBetweenItems?: number;
  delayBetweenClicks?: number;
  stashGrid?: { width: number; height: number };
}

export interface ItemProcessResult {
  position: { x: number; y: number };
  isMatched: boolean;
  averageColor: { r: number; g: number; b: number };
  processed: boolean;
  error?: string;
  isEmpty: boolean;
}

export interface ProcessOptions {
  orbType?: string;
  skipPattern?: string | RegExp;
  delayBetweenClicks?: number;
  delayBetweenItems?: number;
  mouseTimeout?: number;
  useOrb?: boolean;
  maxAttempts?: number;
  itemGrid?: { width: number; height: number };
  customColorThresholds?: {
    matched: { saturation: number; value: number };
    unmatched: { saturation: number; value: number };
  };
}

export interface StashGrid {
  startX: number;
  startY: number;
  width: number;
  height: number;
  itemSize: number;
}

export interface ProcessStashOptions extends ProcessOptions {
  stashGrid?: { width: number; height: number };
  onItemProcessed?: (
    result: ItemProcessResult,
    row: number,
    col: number,
    round: number
  ) => void;
  onRoundComplete?: (round: number) => void;
  onComplete?: (totalProcessed: number) => void;
  delayBetweenRounds?: number;
}

export interface UseOrbOnStashOptions extends ProcessOptions {
  stashGrid?: { width: number; height: number };
  onItemProcessed?: (
    result: ItemProcessResult,
    row: number,
    col: number,
    round: number
  ) => void;
  onRoundComplete?: (round: number) => void;
  delayBetweenRounds?: number;
}

export interface AnalyzeStashOptions {
  stashGrid?: { width: number; height: number };
  maxAttempts?: number;
  delayBetweenRounds?: number;
}
