// src/dock/views/modals/scanner-modal.ts
export function abrirScannerModal(): void {
  chrome.windows.create({
    url: chrome.runtime.getURL('dock/scanner.html'),
    type: 'popup',
    width: 400,
    height: 500,
  });
}