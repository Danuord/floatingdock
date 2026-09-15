import type { DockApp } from "../../domain/entities/dock-app";

const STORAGE_KEY = "dockApps";

export async function listDockApps(): Promise<DockApp[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const apps = stored[STORAGE_KEY];

  return Array.isArray(apps) ? (apps as DockApp[]) : [];
}

export async function saveDockApp(urlValue: string): Promise<DockApp> {
  const url = new URL(urlValue);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("La URL debe usar http:// o https://.");
  }

  const apps = await listDockApps();
  const existingApp = apps.find((app) => app.url === url.href);

  if (existingApp) {
    return existingApp;
  }

  const app: DockApp = {
    id: crypto.randomUUID(),
    name: url.hostname.replace(/^www\./, ""),
    url: url.href,
    launchMode: "tab"
  };

  await chrome.storage.local.set({
    [STORAGE_KEY]: [...apps, app]
  });

  return app;
}

export async function findDockAppById(
  appId: string
): Promise<DockApp | undefined> {
  const apps = await listDockApps();

  return apps.find((app) => app.id === appId);
}

export async function updateDockApp(updatedApp: DockApp): Promise<void> {
  const apps = await listDockApps();

  await chrome.storage.local.set({
    [STORAGE_KEY]: apps.map((app) =>
      app.id === updatedApp.id ? updatedApp : app
    )
  });
}

export async function updateDockAppFavicon(
  tabId: number,
  faviconUrl: string
): Promise<void> {
  const apps = await listDockApps();
  const app = apps.find((item) => item.tabId === tabId);

  if (!app || app.faviconUrl === faviconUrl) {
    return;
  }

  await updateDockApp({
    ...app,
    faviconUrl
  });
}