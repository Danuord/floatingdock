export interface OpenWebAppRequest {
  type: "OPEN_WEB_APP";
  url: string;
}

export interface OpenWebAppResponse {
  ok: boolean;
  tabId?: number;
  error?: string;
}

export function isOpenWebAppRequest(
  message: unknown
): message is OpenWebAppRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    "url" in message &&
    (message as OpenWebAppRequest).type === "OPEN_WEB_APP" &&
    typeof (message as OpenWebAppRequest).url === "string"
  );
}

export interface LaunchDockAppRequest {
  type: "LAUNCH_DOCK_APP";
  appId: string;
}

export interface LaunchDockAppResponse {
  ok: boolean;
  tabId?: number;
  error?: string;
}

export function isLaunchDockAppRequest(
  message: unknown
): message is LaunchDockAppRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    "appId" in message &&
    (message as LaunchDockAppRequest).type === "LAUNCH_DOCK_APP" &&
    typeof (message as LaunchDockAppRequest).appId === "string"
  );
}

export interface SheetsRequest {
  type: 'SHEETS';
  accion: 'upsertRouter' | 'insertMovimiento' | 'getAll';
  payload?: unknown;
}

export interface SheetsResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}