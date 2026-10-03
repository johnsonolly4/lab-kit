import { Platform } from "obsidian";

/**
 * True only where Node/Electron modules (fs, path, crypto, child_process) may be loaded.
 * `Platform.isDesktopApp` alone is not enough: Obsidian's mobile emulation (`app.emulateMobile(true)`)
 * leaves it true, and loading a Node package there logs "Attempting to load NodeJS package".
 */
export const hasNode = (): boolean => Platform.isDesktopApp && !Platform.isMobile;
