export interface OpenWebAppRequest {
  type: "OPEN_WEB_APP";
  url: string;
}

export interface OpenWebAppResponse {
  ok: boolean;
  windowId?: number;
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