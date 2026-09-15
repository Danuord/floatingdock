import {
  isOpenWebAppRequest,
  type OpenWebAppResponse
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

  void createWebAppWindow(message.url, sendResponse);

  // Mantiene activo el canal para responder cuando termine la operación asíncrona.
  return true;
});

async function createWebAppWindow(
  url: string,
  sendResponse: (response: OpenWebAppResponse) => void
): Promise<void> {
  try {
  const createdWindow = await chrome.windows.create({
    ...DEFAULT_WINDOW_OPTIONS,
    url
  });

  if (!createdWindow || typeof createdWindow.id !== "number") {
  sendResponse({
    ok: false,
    error: "Edge no devolvió una ventana válida."
  });

    return;
}

  const windowId: number = createdWindow.id;

  sendResponse({
    ok: true,
    windowId
  });
} catch (error) {
  // ...
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