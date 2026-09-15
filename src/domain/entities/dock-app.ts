export type AppLaunchMode = "tab" | "floating";

export interface WindowBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FloatingWindowState {
  windowId?: number;
  pinned: boolean;
  width: number;
  lastBounds?: WindowBounds;
}

export interface DockApp {
  id: string;
  name: string;
  url: string;
  tabId?: number;
  faviconUrl?: string;
  launchMode?: AppLaunchMode;
  floatingWindow?: FloatingWindowState;
}