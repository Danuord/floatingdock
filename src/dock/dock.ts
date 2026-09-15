import type {
  AppLaunchMode,
  DockApp
} from "../domain/entities/dock-app";
import {
  listDockApps,
  saveDockApp,
  updateDockApp
} from "../infrastructure/storage/chrome-app-repository";

import {
  type LaunchDockAppRequest,
  type LaunchDockAppResponse
} from "../shared/messages";

const form = document.querySelector<HTMLFormElement>("#save-app-form");
const input = document.querySelector<HTMLInputElement>("#app-url");
const status = document.querySelector<HTMLParagraphElement>("#status");
const appList = document.querySelector<HTMLUListElement>("#app-list");

if (!form || !input || !status || !appList) {
  throw new Error("No se encontró la interfaz del dock.");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const app = await saveDockApp(input.value.trim());

    status.textContent = `"${app.name}" guardada correctamente.`;
    input.value = "";

    await renderApps();
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : "No se pudo guardar la página.";
  }
});

async function renderApps(): Promise<void> {
    if (!appList) {
        throw new Error("No se encontró la lista de aplicaciones.");
    }
    const apps = await listDockApps();

    appList.replaceChildren(
        ...apps.map((app) => createAppItem(app))
    );
}

function createAppItem(app: DockApp): HTMLLIElement {
  const item = document.createElement("li");
  const launchButton = document.createElement("button");
  const modeSelect = document.createElement("select");

  launchButton.type = "button";
  launchButton.textContent = app.name;

  launchButton.addEventListener("click", () => {
    void launchApp(app);
  });

  const tabOption = new Option("Pestaña", "tab");
  const floatingOption = new Option("Flotante", "floating");

  modeSelect.append(tabOption, floatingOption);
  modeSelect.value = app.launchMode ?? "tab";

  modeSelect.addEventListener("change", () => {
    void changeLaunchMode(
      app,
      modeSelect.value as AppLaunchMode
    );
  });

  item.append(launchButton, modeSelect);

  return item;
}

function createFallbackIcon(app: DockApp): HTMLSpanElement {
  const fallback = document.createElement("span");

  fallback.textContent = app.name.charAt(0).toUpperCase();

  return fallback;
}

async function launchApp(app: DockApp): Promise<void> {
  const statusElement = status;

  if (!statusElement) {
    throw new Error("No se encontró el área de estado.");
  }

  statusElement.textContent = `Abriendo ${app.name}...`;

  const request: LaunchDockAppRequest = {
    type: "LAUNCH_DOCK_APP",
    appId: app.id
  };

  const response: LaunchDockAppResponse =
    await chrome.runtime.sendMessage(request);

  statusElement.textContent = response.ok
    ? `${app.name} está activa.`
    : `Error: ${response.error ?? "Error desconocido."}`;
}

void renderApps();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.dockApps) {
    void renderApps();
  }
});

async function changeLaunchMode(
  app: DockApp,
  launchMode: AppLaunchMode
): Promise<void> {
  await updateDockApp({
    ...app,
    launchMode,
    floatingWindow:
      launchMode === "floating"
        ? app.floatingWindow ?? {
            pinned: true,
            width: 420
          }
        : app.floatingWindow
  });

  await renderApps();
}