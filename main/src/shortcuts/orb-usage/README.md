# Orb Usage Module

This directory contains the modularized orb usage functionality, broken down into smaller, focused modules for better maintainability and organization.

## Structure

```
orb-usage/
├── index.ts              # Main API exports
├── types.ts              # Type definitions and interfaces
├── constants.ts          # Configuration constants
├── utils.ts              # Utility functions
├── state.ts              # State management and stopping mechanisms
├── processor.ts          # Core item processing logic
├── cursor-processor.ts   # Cursor-based processing
├── stash-processor.ts    # Stash grid processing
└── README.md             # This file
```

## Modules

### `types.ts`

Contains all TypeScript interfaces and type definitions used throughout the orb usage functionality.

### `constants.ts`

Configuration constants including mouse timeouts, stash dimensions, and bounds.

### `utils.ts`

Utility functions for human-like randomization and position calculations.

### `state.ts`

Global state management, stopping mechanisms, and position tracking.

### `processor.ts`

Core item processing logic that handles individual item analysis and orb usage.

### `cursor-processor.ts`

Functions for processing items at the current mouse cursor position.

### `stash-processor.ts`

Grid-based processing of stash items with round-based execution.

### `index.ts`

Main API module that exports all public functions and provides the high-level interface.

## Usage

### Basic Usage

```typescript
import { useOrbOnStash, analyzeStash, useOrbOnMouse } from "./orb-usage";

// Use orb on entire stash
const results = await useOrbOnStash(orbPosition, ocrWorker, overlay, options);

// Analyze stash without using orbs
const analysis = await analyzeStash(ocrWorker, overlay, options);

// Use orb on item at cursor
const result = await useOrbOnMouse(options, ocrWorker, overlay);
```

### Advanced Usage

```typescript
import { processStashItems, processItemAtCursor } from "./orb-usage";

// Direct access to core functions
const results = await processStashItems(ocrWorker, overlay, {
  maxAttempts: 3,
  delayBetweenItems: 200,
  onItemProcessed: (result, row, col, round) => {
    console.log(`Processed item at ${row},${col} in round ${round}`);
  },
});
```

## Backward Compatibility

The original `orb-usage.ts` file now re-exports all functionality from the new modular structure, ensuring complete backward compatibility with existing code.

## Benefits

1. **Modularity**: Each module has a single responsibility
2. **Maintainability**: Easier to locate and modify specific functionality
3. **Testability**: Individual modules can be tested in isolation
4. **Reusability**: Core functions can be imported and used independently
5. **Organization**: Clear separation of concerns
6. **Documentation**: Each module is self-contained and documented
