// ============================================================
// API Client — Google Apps Script Backend
// ============================================================

var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyR1J1raZ4s7VdzK_OuU4kn9_0vbvRrcj5J6I-10vNqeQJp83UyrmxpooT2670nBl-hvg/exec';

function callAPI(fnName) {
  var args = Array.prototype.slice.call(arguments, 1);
  // uploadFile ใช้ POST เพราะ base64 ใหญ่เกิน URL length limit
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
      console.error('API Error [' + fnName + ']:', err);
      throw err;
    });
  }
  var url = APPS_SCRIPT_URL + '?fn=' + encodeURIComponent(fnName) + '&args=' + encodeURIComponent(JSON.stringify(args));
  console.log('[API] GET', url);

  return fetch(url, { method: 'GET', mode: 'cors' }).then(function(res) {
    console.log('[API] Response', res.status);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }).then(function(data) {
    console.log('[API] Data', data);
    return data;
  }).catch(function(err) {
    console.error('[API] FAIL [' + fnName + ']:', err);
    console.error('[API] URL:', APPS_SCRIPT_URL);
    console.error('[API] หาก deploy code.gs ใหม่และได้ URL ใหม่ ให้แก้ APPS_SCRIPT_URL ใน api.js');
    throw err;
  });
}

// Helper: แปลง file_id เป็น URL สำหรับแสดงรูป
function getFileDataUrl(fileId) {
  if (!fileId) return '';
  if (String(fileId).indexOf('http') === 0 || String(fileId).indexOf('data:') === 0) return fileId;
  return 'https://lh5.googleusercontent.com/d/' + fileId;
}
