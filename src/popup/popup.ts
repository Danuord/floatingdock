import {
  type OpenWebAppRequest,
  type OpenWebAppResponse
} from "../shared/messages";

const form = document.querySelector<HTMLFormElement>("#open-app-form");
const input = document.querySelector<HTMLInputElement>("#app-url");
const status = document.querySelector<HTMLParagraphElement>("#status");

if (!form || !input || !status) {
  throw new Error("No se encontró la interfaz del popup.");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = input.value.trim();
  status.textContent = "Abriendo ventana...";

  const request: OpenWebAppRequest = {
    type: "OPEN_WEB_APP",
    url
  };

  const response: OpenWebAppResponse =
  await chrome.runtime.sendMessage(request);

  status.textContent = response.ok
    ? "Ventana creada correctamente."
    : `Error: ${response.error ?? "Error desconocido."}`;
});