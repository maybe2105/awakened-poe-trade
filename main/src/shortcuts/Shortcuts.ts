import { screen, globalShortcut } from "electron";
import { uIOhook, UiohookKey, UiohookWheelEvent } from "uiohook-napi";
import {
  isModKey,
  KeyToElectron,
  mergeTwoHotkeys,
} from "../../../ipc/KeyToCode";
import { typeInChat, stashSearch } from "./text-box";
import {
  processStashItems,
  analyzeStash,
  cleanupOrbUsage,
  useOrbOnMouse,
  FLAG,
} from "./orb-usage";
import { WidgetAreaTracker } from "../windowing/WidgetAreaTracker";
import { HostClipboard } from "./HostClipboard";
import { OcrWorker } from "../vision/link-main";
import type { ShortcutAction } from "../../../ipc/types";
import type { Logger } from "../RemoteLogger";
import type { OverlayWindow } from "../windowing/OverlayWindow";
import type { GameWindow } from "../windowing/GameWindow";
import type { GameConfig } from "../host-files/GameConfig";
import type { ServerEvents } from "../server";
import { mouse } from "@nut-tree-fork/nut-js";

type UiohookKeyT = keyof typeof UiohookKey;
const UiohookToName = Object.fromEntries(
  Object.entries(UiohookKey).map(([k, v]) => [v, k])
);

export class Shortcuts {
  private actions: ShortcutAction[] = [];
  private stashScroll = false;
  private logKeys = false;
  private areaTracker: WidgetAreaTracker;
  private clipboard: HostClipboard;
  private orbUsageConfig: {
    maxAttempts: number;
    stashGrid: { width: number; height: number };
    itemGrid: { width: number; height: number };
    delayBetweenItems: number;
    delayBetweenRounds: number;
    stashMode: boolean;
    useCustomColors: boolean;
    customColorThresholds: {
      matched: { saturation: number; value: number };
      unmatched: { saturation: number; value: number };
    };
    scanAreaSize: number;
  } = {
    maxAttempts: 1,
    stashGrid: { width: 12, height: 12 },
    itemGrid: { width: 1, height: 1 },
    delayBetweenItems: 300,
    delayBetweenRounds: 300,
    stashMode: true,
    useCustomColors: false,
    customColorThresholds: {
      matched: { saturation: 45, value: 65 },
      unmatched: { saturation: 30, value: 36 },
    },
    scanAreaSize: 58,
  };

  static async create(
    logger: Logger,
    overlay: OverlayWindow,
    poeWindow: GameWindow,
    gameConfig: GameConfig,
    server: ServerEvents
  ) {
    const ocrWorker = await OcrWorker.create(logger);
    const shortcuts = new Shortcuts(
      logger,
      overlay,
      poeWindow,
      gameConfig,
      server,
      ocrWorker
    );
    return shortcuts;
  }

  private updateOrbUsageStatus(
    isRunning: boolean,
    lastOperation: "none" | "single" | "stash" | "analyze"
  ) {
    this.server.sendEventTo("broadcast", {
      name: "MAIN->CLIENT::orb-usage-status",
      payload: {
        isRunning,
        lastOperation,
      },
    });
  }

  private async captureColorAtCursor(captureType: "matched" | "unmatched") {
    try {
      // Ensure game is active
      this.overlay.assertGameActive();


      const currentPos = await mouse.getPosition();

      // Capture screenshot
      const imageData = this.overlay.screenshot();

      // Prepare custom thresholds for analysis
      const customThresholds = this.orbUsageConfig.useCustomColors
        ? this.orbUsageConfig.customColorThresholds
        : undefined;

      // Analyze color at cursor position with the configured scan area size
      const colorResult = await this.ocrWorker.readItemColors(
        imageData,
        currentPos.x,
        currentPos.y,
        customThresholds
      );

      console.log(`Color capture ${captureType}:`, {
        saturation: Math.round(colorResult.saturation || 0),
        value: Math.round(colorResult.value || 0),
        averageColor: colorResult.averageColor,
      });

      // Send result back to UI
      this.server.sendEventTo("broadcast", {
        name: "MAIN->CLIENT::color-capture-result",
        payload: {
          captureType,
          saturation: Math.round(colorResult.saturation || 0),
          value: Math.round(colorResult.value || 0),
          averageColor: colorResult.averageColor,
        },
      });
      // save the config
      this.orbUsageConfig = {
        ...this.orbUsageConfig,
        customColorThresholds: {
          ...this.orbUsageConfig.customColorThresholds,
          [captureType]: { saturation: colorResult.saturation, value: colorResult.value },  
        },
      };
      
    } catch (error) {
      console.error(`Error capturing ${captureType} color:`, error);
    }
  }

  private constructor(
    private logger: Logger,
    private overlay: OverlayWindow,
    private poeWindow: GameWindow,
    private gameConfig: GameConfig,
    private server: ServerEvents,
    private ocrWorker: OcrWorker
  ) {
    this.areaTracker = new WidgetAreaTracker(server, overlay);
    this.clipboard = new HostClipboard(logger);

    this.poeWindow.on("active-change", (isActive) => {
      process.nextTick(() => {
        if (isActive === this.poeWindow.isActive) {
          if (isActive) {
            this.register();
          } else {
            this.unregister();
          }
        }
      });
    });

    this.server.onEventAnyClient("CLIENT->MAIN::user-action", (e) => {
      if (e.action === "stash-search") {
        stashSearch(e.text, this.clipboard, this.overlay);
      }
    });

    // Handle orb usage actions from the UI
    this.server.onEventAnyClient(
      "CLIENT->MAIN::orb-usage-action",
      async (e) => {
        if (e.action === "save-config") {
          console.log("Saving orb usage config from UI:", e.config);
          this.orbUsageConfig = { ...e.config };

          // Update the actions array to include the orb usage shortcuts
        } else if (e.action === "start-orb-usage") {
          console.log("Starting orb usage from UI:", e.config);
          const options = {
            maxAttempts: e.config.maxAttempts,
            stashGrid: e.config.stashGrid,
            delayBetweenItems: e.config.delayBetweenItems,
            delayBetweenRounds: e.config.delayBetweenRounds,
            useOrb: true,
          };

          try {
            await processStashItems(this.ocrWorker, this.overlay, options, this.logger);
          } catch (error) {
            console.error("Error during orb usage:", error);
          } finally {
            cleanupOrbUsage();
          }
        } else if (e.action === "stop-orb-usage") {
          console.log("Stopping orb usage from UI");
          FLAG.stop = 1;
          cleanupOrbUsage();
        } else if (e.action === "analyze-stash") {
          console.log("Starting stash analysis from UI:", e.config);
          const options = {
            maxAttempts: e.config.maxAttempts,
            stashGrid: e.config.stashGrid,
            delayBetweenItems: e.config.delayBetweenItems,
            delayBetweenRounds: e.config.delayBetweenRounds,
          };

          try {
            await analyzeStash(this.ocrWorker, this.overlay, options, this.logger);
          } catch (error) {
            console.error("Error during stash analysis:", error);
          }
        }
      }
    );

    uIOhook.on("keydown", (e) => {
      if (!this.logKeys) return;
      const pressed = eventToString(e);
      this.logger.write(`debug [Shortcuts] Keydown ${pressed}`);
    });
    uIOhook.on("keyup", (e) => {
      if (!this.logKeys) return;
      this.logger.write(
        `debug [Shortcuts] Keyup ${
          UiohookToName[e.keycode] || "not_supported_key"
        }`
      );
    });

    uIOhook.on("wheel", (e) => {
      if (!e.ctrlKey || !this.poeWindow.isActive || !this.stashScroll) return;

      if (!isStashArea(e, this.poeWindow)) {
        if (e.rotation > 0) {
          uIOhook.keyTap(UiohookKey.ArrowRight);
        } else if (e.rotation < 0) {
          uIOhook.keyTap(UiohookKey.ArrowLeft);
        }
      }
    });
  }

  updateActions(
    actions: ShortcutAction[],
    stashScroll: boolean,
    logKeys: boolean,
    restoreClipboard: boolean,
    language: string
  ) {
    this.stashScroll = stashScroll;
    this.logKeys = logKeys;
    this.clipboard.updateOptions(restoreClipboard);
    this.ocrWorker.updateOptions(language);

    const copyItemShortcut = mergeTwoHotkeys(
      "Ctrl + C",
      this.gameConfig.showModsKey
    );
    if (copyItemShortcut !== "Ctrl + C") {
      actions.push({
        shortcut: copyItemShortcut,
        action: { type: "test-only" },
      });
    }

    const allShortcuts = new Set([
      "Ctrl + C",
      "Ctrl + V",
      "Ctrl + A",
      "Ctrl + F",
      "Ctrl + Enter",
      "Home",
      "Delete",
      "Enter",
      "ArrowUp",
      "ArrowRight",
      "ArrowLeft",
      copyItemShortcut,
    ]);

    for (const action of actions) {
      if (
        allShortcuts.has(action.shortcut) &&
        action.action.type !== "test-only"
      ) {
        this.logger.write(
          `error [Shortcuts] Hotkey "${action.shortcut}" reserved by the game will not be registered.`
        );
      }
    }
    actions = actions.filter((action) => !allShortcuts.has(action.shortcut));

    const duplicates = new Set<string>();
    for (const action of actions) {
      if (allShortcuts.has(action.shortcut)) {
        this.logger.write(
          `error [Shortcuts] It is not possible to use the same hotkey "${action.shortcut}" for multiple actions.`
        );
        duplicates.add(action.shortcut);
      } else {
        allShortcuts.add(action.shortcut);
      }
    }
    this.actions = actions.filter(
      (action) =>
        !duplicates.has(action.shortcut) ||
        action.action.type === "toggle-overlay"
    );
  }

  private register() {
    for (const entry of this.actions) {
      const isOk = globalShortcut.register(
        shortcutToElectron(entry.shortcut),
        () => {
          if (this.logKeys) {
            this.logger.write(
              `debug [Shortcuts] Action type: ${entry.action.type}`
            );
          }

          if (entry.keepModKeys) {
            const nonModKey = entry.shortcut
              .split(" + ")
              .filter((key) => !isModKey(key))[0];
            uIOhook.keyToggle(UiohookKey[nonModKey as UiohookKeyT], "up");
          } else {
            entry.shortcut
              .split(" + ")
              .reverse()
              .forEach((key) => {
                uIOhook.keyToggle(UiohookKey[key as UiohookKeyT], "up");
              });
          }

          if (entry.action.type === "toggle-overlay") {
            this.areaTracker.removeListeners();
            this.overlay.toggleActiveState();
          } else if (entry.action.type === "paste-in-chat") {
            typeInChat(entry.action.text, entry.action.send, this.clipboard);
          } else if (entry.action.type === "trigger-event") {
            this.server.sendEventTo("broadcast", {
              name: "MAIN->CLIENT::widget-action",
              payload: { target: entry.action.target },
            });
          } else if (entry.action.type === "stash-search") {
            stashSearch(entry.action.text, this.clipboard, this.overlay);
          } else if (entry.action.type === "copy-item") {
            const { action } = entry;

            const pressPosition = screen.getCursorScreenPoint();

            this.clipboard
              .readItemText()
              .then((clipboard) => {
                this.areaTracker.removeListeners();
                this.server.sendEventTo("last-active", {
                  name: "MAIN->CLIENT::item-text",
                  payload: {
                    target: action.target,
                    clipboard,
                    position: pressPosition,
                    focusOverlay: Boolean(action.focusOverlay),
                  },
                });
                if (action.focusOverlay && this.overlay.wasUsedRecently) {
                  this.overlay.assertOverlayActive();
                }
              })
              .catch(() => {});

            pressKeysToCopyItemText(
              entry.keepModKeys
                ? entry.shortcut.split(" + ").filter((key) => isModKey(key))
                : undefined,
              this.gameConfig.showModsKey
            );
          } else if (
            entry.action.type === "ocr-text" &&
            entry.action.target === "heist-gems"
          ) {
            if (process.platform !== "win32") return;

            const { action } = entry;
            const pressTime = Date.now();
            const imageData = this.poeWindow.screenshot();
            this.ocrWorker
              .findHeistGems({
                width: this.poeWindow.bounds.width,
                height: this.poeWindow.bounds.height,
                data: imageData,
              })
              .then((result) => {
                this.server.sendEventTo("last-active", {
                  name: "MAIN->CLIENT::ocr-text",
                  payload: {
                    target: action.target,
                    pressTime,
                    ocrTime: result.elapsed,
                    paragraphs: result.recognized.map((p) => p.text),
                  },
                });
              })
              .catch(() => {});
          } else if (entry.action.type === "orb-process-mode") {
            // F10 - Process based on current mode (stash or single item)
            if (this.orbUsageConfig.stashMode) {
              console.log("F10: Processing stash (stash mode enabled)");
              this.updateOrbUsageStatus(true, "stash");
              const options = {
                maxAttempts: this.orbUsageConfig.maxAttempts,
                stashGrid: this.orbUsageConfig.stashGrid,
                delayBetweenItems: this.orbUsageConfig.delayBetweenItems,
                delayBetweenRounds: this.orbUsageConfig.delayBetweenRounds,
                useOrb: true,
                itemGrid: this.orbUsageConfig.itemGrid,
                customColorThresholds: this.orbUsageConfig.useCustomColors
                  ? this.orbUsageConfig.customColorThresholds
                  : undefined,
              };
              processStashItems(this.ocrWorker, this.overlay, options, this.logger)
                .catch((error) =>
                  console.error("Error during stash processing:", error)
                )
                .finally(() => {
                  cleanupOrbUsage();
                  this.updateOrbUsageStatus(false, "stash");
                });
            } else {
              console.log("F10: Processing item at cursor (single item mode)");
              this.updateOrbUsageStatus(true, "single");
              const options = {
                useOrb: true,
                maxAttempts: this.orbUsageConfig.maxAttempts,
                delayBetweenItems: this.orbUsageConfig.delayBetweenItems,
                customColorThresholds: this.orbUsageConfig.useCustomColors
                  ? this.orbUsageConfig.customColorThresholds
                  : undefined,
              };
              useOrbOnMouse(options, this.ocrWorker, this.overlay, this.logger)
                .catch((error) =>
                  console.error("Error during cursor processing:", error)
                )
                .finally(() => {
                  this.updateOrbUsageStatus(false, "single");
                });
            }
          } else if (entry.action.type === "orb-process-stash") {
            // Ctrl+F10 - Always process stash regardless of mode
            console.log("Ctrl+F10: Force processing stash");
            this.updateOrbUsageStatus(true, "stash");
            const options = {
              maxAttempts: this.orbUsageConfig.maxAttempts,
              stashGrid: this.orbUsageConfig.stashGrid,
              delayBetweenItems: this.orbUsageConfig.delayBetweenItems,
              delayBetweenRounds: this.orbUsageConfig.delayBetweenRounds,
              useOrb: true,
              itemGrid: this.orbUsageConfig.itemGrid,
              customColorThresholds: this.orbUsageConfig.useCustomColors
                ? this.orbUsageConfig.customColorThresholds
                : undefined,
            };
            processStashItems(this.ocrWorker, this.overlay, options, this.logger)
              .catch((error) =>
                console.error("Error during forced stash processing:", error)
              )
              .finally(() => {
                cleanupOrbUsage();
                this.updateOrbUsageStatus(false, "stash");
              });
          } else if (entry.action.type === "orb-stop") {
            // F11 - Stop any running orb operation
            console.log("F11: Stopping orb operations");
            FLAG.stop = 1;
            FLAG.escPressed = true; // Trigger immediate stop
            cleanupOrbUsage();
            this.updateOrbUsageStatus(false, "none");
          } else if (entry.action.type === "orb-capture-matched-color") {
            // ; - Capture color at cursor for matched items (when custom colors enabled)
            if (this.orbUsageConfig.useCustomColors) {
              console.log("Semicolon: Capturing matched item color at cursor");
              this.captureColorAtCursor("matched");
            }
          } else if (entry.action.type === "orb-capture-unmatched-color") {
            // ' - Capture color at cursor for unmatched items (when custom colors enabled)
            if (this.orbUsageConfig.useCustomColors) {
              console.log(
                "Apostrophe: Capturing unmatched item color at cursor"
              );
              this.captureColorAtCursor("unmatched");
            }
          }
        }
      );

      if (!isOk) {
        this.logger.write(
          `error [Shortcuts] Failed to register a shortcut "${entry.shortcut}". It is already registered by another application.`
        );
      }

      if (entry.action.type === "test-only") {
        globalShortcut.unregister(shortcutToElectron(entry.shortcut));
      }
    }
  }

  private unregister() {
    globalShortcut.unregisterAll();
  }
}

function pressKeysToCopyItemText(
  pressedModKeys: string[] = [],
  showModsKey: string
) {
  let keys = mergeTwoHotkeys("Ctrl + C", showModsKey).split(" + ");
  keys = keys.filter((key) => key !== "C");
  if (process.platform !== "darwin") {
    // On non-Mac platforms, don't toggle keys that are already being pressed.
    //
    // For unknown reasons, we need to toggle pressed keys on Mac for advanced
    // mod descriptions to be copied. You can test this by setting the shortcut
    // to "Alt + any letter". They'll work with this line, but not if it's
    // commented out.
    keys = keys.filter((key) => !pressedModKeys.includes(key));
  }

  for (const key of keys) {
    uIOhook.keyToggle(UiohookKey[key as UiohookKeyT], "down");
  }

  // finally press `C` to copy text
  uIOhook.keyTap(UiohookKey.C);

  keys.reverse();
  for (const key of keys) {
    uIOhook.keyToggle(UiohookKey[key as UiohookKeyT], "up");
  }
}

function isStashArea(mouse: UiohookWheelEvent, poeWindow: GameWindow): boolean {
  if (
    !poeWindow.bounds ||
    mouse.x > poeWindow.bounds.x + poeWindow.uiSidebarWidth
  )
    return false;

  return (
    mouse.y > poeWindow.bounds.y + (poeWindow.bounds.height * 154) / 1600 &&
    mouse.y < poeWindow.bounds.y + (poeWindow.bounds.height * 1192) / 1600
  );
}

function eventToString(e: {
  keycode: number;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}) {
  const { ctrlKey, shiftKey, altKey } = e;

  let code = UiohookToName[e.keycode];
  if (!code) return "not_supported_key";

  if (code === "Shift" || code === "Alt" || code === "Ctrl") return code;

  if (ctrlKey && shiftKey && altKey) code = `Ctrl + Shift + Alt + ${code}`;
  else if (shiftKey && altKey) code = `Shift + Alt + ${code}`;
  else if (ctrlKey && shiftKey) code = `Ctrl + Shift + ${code}`;
  else if (ctrlKey && altKey) code = `Ctrl + Alt + ${code}`;
  else if (altKey) code = `Alt + ${code}`;
  else if (ctrlKey) code = `Ctrl + ${code}`;
  else if (shiftKey) code = `Shift + ${code}`;

  return code;
}

function shortcutToElectron(shortcut: string) {
  return shortcut
    .split(" + ")
    .map((k) => KeyToElectron[k as keyof typeof KeyToElectron])
    .join("+");
}
