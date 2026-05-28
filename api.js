// ============================================================
// API Client — Auto-routes to Mock (offline) or Google Apps Script (online)
// ============================================================

var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxusMdJwKy9jgsjHgCd38faJWlglARu_mesSHdiCdgNZd_LD2iNaVMPvgCn1P9zgp4q/exec';

// ── Mock mode ──────────────────────────────────────────────
// เปลี่ยนเป็น true เพื่อใช้ mock-api (ไม่ต้องมี internet / GAS)
// เปลี่ยนเป็น false เพื่อใช้ Google Apps Script จริง
var USE_MOCK = true;

function callAPI(fnName) {
  var args = Array.prototype.slice.call(arguments, 1);

  // ── Mock path ──
  if (USE_MOCK) {
    return new Promise(function(resolve, reject) {
      setTimeout(function() {          // จำลอง network latency 80ms
        try {
          var mock = window._mockAPI;
          if (!mock || typeof mock[fnName] !== 'function') {
            console.warn('[Mock] ไม่พบ function:', fnName);
            resolve({ success: false, message: 'Mock: ไม่รองรับ ' + fnName });
            return;
          }
          var result = mock[fnName].apply(mock, args);
          resolve(result);
        } catch(e) {
          console.error('[Mock] Error in', fnName, e);
          reject(e);
        }
      }, 80);
    });
  }

  // ── Real GAS path ──
  if (fnName === 'uploadFile') {
    var body = 'fn=' + encodeURIComponent(fnName) + '&args=' + encodeURIComponent(JSON.stringify(args));
    return fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    }).then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).catch(function(err) {
      console.error('[API] uploadFile error:', err);
      throw err;
    });
  }

  var url = APPS_SCRIPT_URL + '?fn=' + encodeURIComponent(fnName) + '&args=' + encodeURIComponent(JSON.stringify(args));
  return fetch(url, { method: 'GET', mode: 'cors' }).then(function(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }).catch(function(err) {
    console.error('[API] FAIL [' + fnName + ']:', err);
    throw err;
  });
}

// Helper: แปลง file_id เป็น URL สำหรับแสดงรูป
function getFileDataUrl(fileId) {
  if (!fileId) return '';
  if (String(fileId).indexOf('http') === 0 || String(fileId).indexOf('data:') === 0) return fileId;
  return 'https://lh5.googleusercontent.com/d/' + fileId;
}
