import {
  isOpenWebAppRequest,
  type OpenWebAppResponse
} from "../shared/messages";

import {
  findDockAppById,
  updateDockApp,
  updateDockAppFavicon
} from "../infrastructure/storage/chrome-app-repository";

import {
  isLaunchDockAppRequest,
  type LaunchDockAppResponse
} from "../shared/messages";

import type {
  DockApp,
  WindowBounds
} from "../domain/entities/dock-app";

import type { SheetsRequest, SheetsResponse } from '../shared/messages';

const DEFAULT_FLOATING_HEIGHT = 620;
const DEFAULT_FLOATING_WIDTH = 420;
const SIDEBAR_RESERVED_WIDTH = 382;
const FLOATING_WINDOW_GAP = 8;
const FLOATING_TOP_OFFSET = 87;

const DEFAULT_WINDOW_OPTIONS = {
  type: "popup" as const,
  width: 420,
  height: 720,
  focused: true
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isOpenWebAppRequest(message)) {
    return;
  }

  if (!isValidWebUrl(message.url)) {
    const response: OpenWebAppResponse = {
      ok: false,
      error: "La URL debe comenzar por http:// o https://."
    };

    sendResponse(response);
    return;
  }

  void createWebAppTab(message.url, sendResponse);

  // Mantiene activo el canal para responder cuando termine la operación asíncrona.
  return true;
});

async function createWebAppTab(
  url: string,
  sendResponse: (response: OpenWebAppResponse) => void
): Promise<void> {
  try {
    const focusedWindow = await chrome.windows.getLastFocused();

    if (!focusedWindow || typeof focusedWindow.id !== "number") {
      sendResponse({
        ok: false,
        error: "No se encontró una ventana de Edge válida."
      });

      return;
    }

    const createdTab = await chrome.tabs.create({
      windowId: focusedWindow.id,
      url,
      active: true
    });

    if (!createdTab || typeof createdTab.id !== "number") {
      sendResponse({
        ok: false,
        error: "Edge no devolvió una pestaña válida."
      });

      return;
    }

    sendResponse({
      ok: true,
      tabId: createdTab.id
    });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Error desconocido."
    });
  }
}

function isValidWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

chrome.action.onClicked.addListener((tab) => {
  console.log("Intentando abrir el panel lateral.", tab.windowId);

  void chrome.sidePanel.open({ windowId: tab.windowId }).catch((error) => {
    console.error("No se pudo abrir el panel lateral:", error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isLaunchDockAppRequest(message)) {
    return;
  }

  void launchDockApp(message.appId, sendResponse);

  return true;
});

async function launchDockApp(
  appId: string,
  sendResponse: (response: LaunchDockAppResponse) => void
): Promise<void> {
  try {
    const app = await findDockAppById(appId);

    if (!app) {
      sendResponse({
        ok: false,
        error: "No se encontró la aplicación guardada."
      });

      return;
    }

    if ((app.launchMode ?? "tab") === "floating") {
      await toggleFloatingApp(app, sendResponse);
      return;
    }

    await launchTabApp(app, sendResponse);
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Error desconocido."
    });
  }
}

async function launchTabApp(
  app: DockApp,
  sendResponse: (response: LaunchDockAppResponse) => void
): Promise<void> {
  if (typeof app.tabId === "number") {
    try {
      const existingTab = await chrome.tabs.get(app.tabId);

      if (existingTab && typeof existingTab.windowId === "number") {
        await chrome.windows.update(existingTab.windowId, {
          focused: true
        });

        await chrome.tabs.update(app.tabId, {
          active: true
        });

        sendResponse({
          ok: true,
          tabId: app.tabId
        });

        return;
      }
    } catch {
      // La pestaña fue cerrada; se creará una nueva.
    }
  }

  const focusedWindow = await chrome.windows.getLastFocused();

  if (!focusedWindow || typeof focusedWindow.id !== "number") {
    sendResponse({
      ok: false,
      error: "No se encontró una ventana de Edge válida."
    });

    return;
  }

  const createdTab = await chrome.tabs.create({
    windowId: focusedWindow.id,
    url: app.url,
    active: true
  });

  if (!createdTab || typeof createdTab.id !== "number") {
    sendResponse({
      ok: false,
      error: "Edge no devolvió una pestaña válida."
    });

    return;
  }

  await updateDockApp({
    ...app,
    tabId: createdTab.id
  });

  sendResponse({
    ok: true,
    tabId: createdTab.id
  });
}

async function toggleFloatingApp(
  app: DockApp,
  sendResponse: (response: LaunchDockAppResponse) => void
): Promise<void> {
  const existingWindowId = app.floatingWindow?.windowId;

  if (typeof existingWindowId === "number") {
    try {
      const existingWindow = await chrome.windows.get(existingWindowId);

      if (existingWindow.state === "minimized") {
        const restoredWindow = await chrome.windows.update(existingWindowId, {
          state: "normal",
          focused: true
        });

        await saveFloatingWindowState(app, restoredWindow);

        sendResponse({ ok: true });
        return;
      }

      await chrome.windows.update(existingWindowId, {
        state: "minimized"
      });

      sendResponse({ ok: true });
      return;
    } catch {
      // La ventana fue cerrada; se creará otra.
    }
  }

  const mainWindow = await chrome.windows.getLastFocused();

  if (!mainWindow || typeof mainWindow.id !== "number") {
    sendResponse({
      ok: false,
      error: "No se encontró la ventana principal de Edge."
    });

    return;
  }

  const width = app.floatingWindow?.width ?? DEFAULT_FLOATING_WIDTH;
  const mainWindowHeight = mainWindow.height ?? DEFAULT_FLOATING_HEIGHT;
  const availableHeight = Math.max(
    1,
    mainWindowHeight - FLOATING_TOP_OFFSET
  );

  const height = Math.min(
    availableHeight,
    DEFAULT_FLOATING_HEIGHT
  );

  const top = (mainWindow.top ?? 0) + FLOATING_TOP_OFFSET;

  const left = Math.max(
    0,
    (mainWindow.left ?? 0) +
      (mainWindow.width ?? width) -
      SIDEBAR_RESERVED_WIDTH -
      width -
      FLOATING_WINDOW_GAP
  );

  const createdWindow = await chrome.windows.create({
    type: "popup",
    url: app.url,
    width,
    height,
    left,
    top,
    focused: true
  });

  if (!createdWindow || typeof createdWindow.id !== "number") {
    sendResponse({
      ok: false,
      error: "Edge no devolvió una ventana flotante válida."
    });

    return;
  }

  await saveFloatingWindowState(app, createdWindow);

  sendResponse({ ok: true });
}

async function saveFloatingWindowState(
  app: DockApp,
  floatingWindow: chrome.windows.Window
): Promise<void> {
  if (typeof floatingWindow.id !== "number") {
    return;
  }

  await updateDockApp({
    ...app,
    floatingWindow: {
      windowId: floatingWindow.id,
      pinned: app.floatingWindow?.pinned ?? true,
      width: floatingWindow.width ?? DEFAULT_FLOATING_WIDTH,
      lastBounds: getWindowBounds(floatingWindow)
    }
  });
}

function getWindowBounds(
  browserWindow: chrome.windows.Window
): WindowBounds | undefined {
  const { left, top, width, height } = browserWindow;

  if (
    typeof left !== "number" ||
    typeof top !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return undefined;
  }

  return { left, top, width, height };
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (
    typeof changeInfo.favIconUrl !== "string" ||
    changeInfo.favIconUrl.length === 0
  ) {
    return;
  }

  void updateDockAppFavicon(tabId, changeInfo.favIconUrl);
});

const SHEETS_URL =
  'https://script.google.com/macros/s/AKfycbxE9PyPbxc7oFE6h1mFWc2TiDKMy9uF-W45EtlHvphCN74FFInXh4Vxlv4obFTdGH0/exec';

chrome.runtime.onMessage.addListener(
  (req: SheetsRequest, _sender, sendResponse: (r: SheetsResponse) => void) => {
    if (req.type !== 'SHEETS') return false;

    (async () => {
      try {
        let res: Response;
        if (req.accion === 'getAll') {
          const agencia = (req.payload as { agencia?: string })?.agencia ?? 'paraiso';
          res = await fetch(`${SHEETS_URL}?agencia=${agencia}`);
        } else {
          res = await fetch(SHEETS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              accion: req.accion,
              ...(req.payload as object ?? {}),
            }),
            redirect: 'follow',
          });
        }
        const data = await res.json();
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    })();

    return true; // mantener el canal abierto para respuesta async
  },
);