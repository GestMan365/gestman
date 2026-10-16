import { BrowserQRCodeReader } from '@zxing/browser';

let activeScan = null;

function closeScan() {
  const scan = activeScan;
  if (!scan) return;
  activeScan = null;
  scan.stopped = true;
  scan.controls?.stop();
  scan.video?.srcObject?.getTracks?.().forEach(track => track.stop());
  scan.overlay.remove();
  document.removeEventListener('keydown', scan.onKeydown);
  document.removeEventListener('visibilitychange', scan.onVisibility);
  scan.returnFocus?.focus?.({ preventScroll: true });
}

async function startCamera(scan) {
  if (scan.stopped) return;
  scan.status.textContent = 'Solicitando acesso à câmera…';
  scan.retry.hidden = true;
  try {
    const reader = new BrowserQRCodeReader();
    const controls = await reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
      scan.video,
      (result, _error, sessionControls) => {
        if (!result || scan.stopped) return;
        const value = result.getText();
        sessionControls.stop();
        closeScan();
        scan.onResult(value);
      }
    );
    if (scan.stopped) controls.stop();
    else {
      scan.controls = controls;
      scan.status.textContent = 'Aponte a câmera para o QR Code do equipamento.';
    }
  } catch (error) {
    if (scan.stopped) return;
    const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
    scan.status.textContent = denied
      ? 'Acesso à câmera negado. Libere a câmera nas permissões do navegador e tente novamente.'
      : 'Não foi possível abrir a câmera. Verifique a câmera e tente novamente.';
    scan.retry.hidden = false;
  }
}

function openScan({ onResult }) {
  closeScan();
  const overlay = document.createElement('div');
  overlay.className = 'asset-qr-scanner';
  overlay.id = 'assetQrScanner';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Ler QR Code do equipamento');
  overlay.innerHTML = `
    <div class="asset-qr-scanner-card">
      <header><strong>Ler QR Code do equipamento</strong><button type="button" class="asset-qr-close" aria-label="Fechar leitor de QR Code">×</button></header>
      <div class="asset-qr-video-wrap"><video autoplay muted playsinline aria-label="Imagem da câmera para leitura do QR Code"></video><span class="asset-qr-target" aria-hidden="true"></span></div>
      <p class="asset-qr-status" role="status" aria-live="polite">Solicitando acesso à câmera…</p>
      <button type="button" class="asset-qr-retry" hidden>Tentar novamente</button>
    </div>`;
  const scan = {
    overlay,
    video: overlay.querySelector('video'),
    status: overlay.querySelector('.asset-qr-status'),
    retry: overlay.querySelector('.asset-qr-retry'),
    controls: null,
    stopped: false,
    onResult,
    returnFocus: document.activeElement,
    onKeydown: event => { if (event.key === 'Escape') closeScan(); },
    onVisibility: () => { if (document.hidden) closeScan(); },
  };
  activeScan = scan;
  document.body.append(overlay);
  overlay.querySelector('.asset-qr-close').addEventListener('click', closeScan);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeScan(); });
  scan.retry.addEventListener('click', () => startCamera(scan));
  document.addEventListener('keydown', scan.onKeydown);
  document.addEventListener('visibilitychange', scan.onVisibility);
  overlay.querySelector('.asset-qr-close').focus({ preventScroll: true });
  startCamera(scan);
}

window.GMAssetQrScanner = { open: openScan, close: closeScan };
