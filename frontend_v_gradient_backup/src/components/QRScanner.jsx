import React, { useEffect, useRef, useState } from "react";

const READER_ID = "event-ticket-qr-reader";

function cameraMessage(error) {
  const name = error?.name || "";
  const message = String(error?.message || error || "");
  if (name === "NotAllowedError" || /permission|denied|notallowed/i.test(message)) {
    return "Camera access was denied. Allow camera permission or use manual ticket entry.";
  }
  if (name === "NotFoundError" || /not found|no camera|devicesnotfound/i.test(message)) {
    return "No camera is available on this device. Use manual ticket entry.";
  }
  if (!window.isSecureContext) {
    return "Camera access requires HTTPS. Use localhost for development or use manual ticket entry.";
  }
  return "Unable to start the camera. Please use manual ticket entry.";
}

function QRScanner({ onScan, onClose }) {
  const scannerRef = useRef(null), startGuard = useRef(false), stopGuard = useRef(null), scanLocked = useRef(false);
  const onScanRef = useRef(onScan), onCloseRef = useRef(onClose);
  const [starting, setStarting] = useState(true), [error, setError] = useState("");
  useEffect(() => { onScanRef.current = onScan; onCloseRef.current = onClose; }, [onScan, onClose]);

  const disposeScanner = async (scanner) => {
    try { if (scanner?.isScanning) await scanner.stop(); } catch { /* Camera may already be stopped. */ }
    try { scanner?.clear(); } catch { /* Reader may not have initialized. */ }
    if (scannerRef.current === scanner) scannerRef.current = null;
  };
  const stop = async () => {
    if (stopGuard.current) return stopGuard.current;
    const scanner = scannerRef.current;
    if (!scanner) return undefined;
    stopGuard.current = disposeScanner(scanner);
    await stopGuard.current;
    return undefined;
  };

  useEffect(() => {
    let disposed = false;
    const frame = window.requestAnimationFrame(async () => {
      if (disposed || startGuard.current) return;
      startGuard.current = true;
      let scanner = null;
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (disposed) return;
        scanner = new Html5Qrcode(READER_ID, false);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          async (decodedText) => {
            const code = decodedText.trim();
            if (!code || scanLocked.current) return;
            scanLocked.current = true;
            await stop();
            if (!disposed) onScanRef.current(code);
          },
          () => {},
        );
        if (disposed) await disposeScanner(scanner);
        else setStarting(false);
      } catch (startError) {
        if (scanner) await disposeScanner(scanner);
        else await stop();
        if (!disposed) { setStarting(false); setError(cameraMessage(startError)); }
      }
    });
    return () => { disposed = true; startGuard.current = false; window.cancelAnimationFrame(frame); void stop(); };
  }, []);

  const close = async () => { scanLocked.current = true; await stop(); onCloseRef.current(); };

  return <div className="qr-scanner-overlay" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title"><section className="qr-scanner-modal"><div className="editor-heading"><div><p className="eyebrow">STAFF CHECK-IN</p><h2 id="qr-scanner-title">Scan attendee ticket</h2></div><button type="button" className="secondary-button" onClick={close}>Close</button></div><div className="qr-reader-frame"><div id={READER_ID}/>{starting && !error && <div className="scanner-loading"><div className="app-loader"/><p>Starting camera...</p></div>}</div>{error ? <div className="inline-message error-message" role="alert">{error}</div> : <p className="scanner-help">Point the camera at the attendee QR code. Production camera access requires HTTPS; localhost is supported for development.</p>}<button type="button" className="secondary-button scanner-close-button" onClick={close}>Close scanner</button></section></div>;
}

export default QRScanner;
