// src/dock/scanner.ts
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';


const video = document.querySelector<HTMLVideoElement>('#video')!;
const PREFIJOS_VALIDOS = ['OPTI', 'ZTE', 'HWT', 'ZXI', 'XPON', 'FHT', 'OEMT'];

const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
]);
hints.set(DecodeHintType.TRY_HARDER, true);
const reader = new BrowserMultiFormatReader(hints);
const SCANNER_KEY = 'scanner-result';

reader
  .decodeFromVideoDevice(null, video, (result) => {
    if (!result) return;
    const codigo = result.getText().trim();
    const valido = PREFIJOS_VALIDOS.some(p => codigo.toUpperCase().startsWith(p));
    if (!valido) return;

    void chrome.storage.local.set({ [SCANNER_KEY]: { codigo, ts: Date.now() } });
    reader.reset();
    window.close();
  })
  .catch((e) => {
    console.error(e);
    alert('No se pudo acceder a la cámara');
    window.close();
  });