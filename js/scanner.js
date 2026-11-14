/* Barcode-Scanner: Live-Kamera (schmale Zeile) + Foto-Scan als Reserve.
   Nutzt BarcodeDetector (Android/Chrome); sonst die mitgelieferte ZXing-Bibliothek (iPhone/Safari). */
var Scanner = (function () {
  var FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];
  var stream = null, timer = null, det = null, reader = null, busy = false, onCode = null, videoEl = null;
  var last = "", lastT = 0;

  /* ----- ZXing nachladen (nur wenn nötig) ----- */
  var zxP = null;
  function loadZxing() {
    if (window.ZXing) return Promise.resolve();
    if (!zxP) zxP = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = "js/zxing.min.js"; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return zxP;
  }
  function makeReader(qr) {
    var Z = window.ZXing, h = new Map(), f = [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128];
    if (qr) f = [Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.EAN_13];
    h.set(Z.DecodeHintType.TRY_HARDER, true);
    h.set(Z.DecodeHintType.POSSIBLE_FORMATS, f);
    return new Z.BrowserMultiFormatReader(h);
  }
  function makeDetector(qr) {
    if (!("BarcodeDetector" in window)) return null;
    try { return new BarcodeDetector({ formats: qr ? ["qr_code", "code_128", "ean_13"] : FORMATS }); } catch (e) { return null; }
  }

  /* ----- Piepton ----- */
  var ac = null;
  function beep() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 1000; g.gain.value = 0.12; o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + 0.09);
    } catch (e) {}
    try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
  }

  /* ----- Live ----- */
  function describeError(e) {
    var n = e && e.name || "";
    if (n === "NotAllowedError" || n === "SecurityError") return "Kamera-Zugriff verweigert. Erlaube die Kamera in den Seiten-Einstellungen des Browsers.";
    if (n === "NotFoundError" || n === "OverconstrainedError") return "Keine Kamera gefunden.";
    if (n === "NotReadableError") return "Die Kamera wird gerade von einer anderen App benutzt.";
    if (!window.isSecureContext) return "Kamera geht nur über https (oder localhost).";
    return "Kamera nicht verfügbar (" + (n || e) + ").";
  }

  function start(video, cb) {
    if (stream) return Promise.resolve();
    videoEl = video; onCode = cb;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      return Promise.reject(new Error(window.isSecureContext ? "Kamera-API fehlt" : "Kamera geht nur über https (oder localhost)."));
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false
    }).catch(function (e) { throw new Error(describeError(e)); }).then(function (s) {
      stream = s; videoEl.srcObject = s; videoEl.muted = true;
      return videoEl.play().catch(function () {});
    }).then(function () {
      var tr = stream.getVideoTracks()[0];
      try { tr.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(function () {}); } catch (e) {}
      det = makeDetector();
      return det ? null : loadZxing().then(function () { reader = makeReader(); });
    }).then(function () {
      timer = setInterval(tick, det ? 160 : 320);
    }).catch(function (e) { stop(); throw e; });
  }

  function stop() {
    clearInterval(timer); timer = null; busy = false;
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (videoEl) videoEl.srcObject = null;
  }
  function running() { return !!stream; }

  function tick() {
    if (busy || !videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return;
    busy = true;
    var p;
    if (det) {
      p = det.detect(videoEl).then(function (r) { return r && r.length ? r[0].rawValue : null; });
    } else {
      p = new Promise(function (res) {
        var W = videoEl.videoWidth, H = videoEl.videoHeight, sh = Math.round(H * 0.5);
        var c = document.createElement("canvas"), sc = Math.min(1, 1280 / W);
        c.width = Math.round(W * sc); c.height = Math.round(sh * sc);
        c.getContext("2d").drawImage(videoEl, 0, (H - sh) / 2, W, sh, 0, 0, c.width, c.height);
        reader.decodeFromImageUrl(c.toDataURL("image/jpeg", 0.85)).then(function (r) { res(r.getText()); }, function () { res(null); });
      });
    }
    p.then(function (code) {
      busy = false;
      if (!code) return;
      var now = Date.now();
      if (code === last && now - lastT < 3500) { lastT = now; return; }   // derselbe Code: nicht doppelt zählen
      last = code; lastT = now; beep();
      if (onCode) onCode(String(code));
    }, function () { busy = false; });
  }

  /* Taschenlampe, falls das Gerät sie anbietet */
  function torchSupported() {
    if (!stream) return false;
    var tr = stream.getVideoTracks()[0];
    return !!(tr && tr.getCapabilities && tr.getCapabilities().torch);
  }
  function setTorch(on) {
    var tr = stream && stream.getVideoTracks()[0];
    if (!tr) return Promise.resolve(false);
    return tr.applyConstraints({ advanced: [{ torch: !!on }] }).then(function () { return !!on; }, function () { return false; });
  }

  /* ----- Foto-Scan (Reserve) ----- */
  function loadImg(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), i = new Image();
      i.onload = function () { res({ img: i, url: u }); }; i.onerror = rej; i.src = u;
    });
  }
  function toCanvas(img, max) {
    var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    var c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c;
  }
  function variants(img) {
    var out = [], W = img.naturalWidth, H = img.naturalHeight;
    [2400, 1400, 900].forEach(function (m) { out.push(toCanvas(img, m)); });
    [[0.15, 0.25, 0.7, 0.5], [0, 0.3, 1, 0.4], [0.25, 0.15, 0.5, 0.7]].forEach(function (r) {
      var sx = W * r[0], sy = H * r[1], sw = W * r[2], sh = H * r[3], sc = Math.min(1, 1800 / Math.max(sw, sh));
      var c = document.createElement("canvas"); c.width = Math.round(sw * sc); c.height = Math.round(sh * sc);
      c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height); out.push(c);
    });
    return out;
  }
  function rotate(c) {
    var r = document.createElement("canvas"); r.width = c.height; r.height = c.width;
    var x = r.getContext("2d"); x.translate(r.width, 0); x.rotate(Math.PI / 2); x.drawImage(c, 0, 0); return r;
  }
  /* qr = true: Kundenkarte (QR-Code oder Strichcode) */
  async function decodePhoto(file, qr) {
    var L = await loadImg(file), code = null, vs = variants(L.img), d = makeDetector(qr);
    if (d) { try { for (var i = 0; i < vs.length && !code; i++) { var r = await d.detect(vs[i]); if (r && r.length) code = r[0].rawValue; } } catch (e) {} }
    if (!code) {
      try {
        await loadZxing(); var rd = makeReader(qr);
        for (var j = 0; j < vs.length && !code; j++) {
          var cands = [vs[j], rotate(vs[j])];
          for (var k = 0; k < cands.length && !code; k++) {
            try { code = (await rd.decodeFromImageUrl(cands[k].toDataURL("image/jpeg", 0.92))).getText(); } catch (e) {}
          }
        }
      } catch (e) {}
    }
    URL.revokeObjectURL(L.url);
    return code;
  }

  /* Produktfoto: quadratisch zuschneiden, klein speichern */
  async function makeThumb(file) {
    var L = await loadImg(file), img = L.img, S = 320, side = Math.min(img.naturalWidth, img.naturalHeight);
    var c = document.createElement("canvas"); c.width = S; c.height = S;
    c.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, S, S);
    URL.revokeObjectURL(L.url);
    return c.toDataURL("image/jpeg", 0.72);
  }

  /* QR-Code als Bild (für die Kundenkarte an der Kasse): ganze Pixel je Modul, weißer Rand */
  function qrSvg(text, size) {
    return loadZxing().then(function () {
      var Z = window.ZXing, m = Z.QRCodeEncoder.encode(text, Z.QRCodeDecoderErrorCorrectionLevel.M, new Map()).getMatrix();
      var n = m.getWidth(), q = 4, mod = Math.max(2, Math.floor(size / (n + 2 * q))), px = mod * (n + 2 * q);
      var c = document.createElement("canvas"); c.width = c.height = px;
      var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, px, px); x.fillStyle = "#000";
      for (var yy = 0; yy < n; yy++) for (var xx = 0; xx < n; xx++) if (m.get(xx, yy) === 1) x.fillRect((xx + q) * mod, (yy + q) * mod, mod, mod);
      c.setAttribute("aria-label", "QR-Code der Kundenkarte");
      return c;
    });
  }

  return { qrSvg: qrSvg, start: start, stop: stop, running: running, torchSupported: torchSupported, setTorch: setTorch,
           decodePhoto: decodePhoto, makeThumb: makeThumb, beep: beep };
})();
