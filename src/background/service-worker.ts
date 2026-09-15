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
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Error desconocido."
    });
  }
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