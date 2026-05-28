// ============================================================
// API Client — Auto-routes to Mock (offline) or Google Apps Script (online)
// ============================================================

var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxehoF9YRI2_pPmE9htNfBVqC6AW71HaPrcCUN_P6522A4nfo3eKKvOumRgP_9Z7OF0Aw/exec';

// ── Mock mode ──────────────────────────────────────────────
// เปลี่ยนเป็น true เพื่อใช้ mock-api (ไม่ต้องมี internet / GAS)
// เปลี่ยนเป็น false เพื่อใช้ Google Apps Script จริง
var USE_MOCK = false;

// ── API Cache ──────────────────────────────────────────────
var API_CACHE = {
  enabled: true,
  ttl: 5 * 60 * 1000, // 5 minutes
  
  get: function(key) {
    if (!this.enabled) return null;
    try {
      var cached = localStorage.getItem('api_cache_' + key);
      if (!cached) return null;
      var data = JSON.parse(cached);
      // Check if expired
      if (Date.now() > data.expire) {
        localStorage.removeItem('api_cache_' + key);
        return null;
      }
      return data.value;
    } catch(e) {
      console.error('[Cache] Get error:', e);
      return null;
    }
  },
  
  set: function(key, value) {
    if (!this.enabled) return;
    try {
      var data = {
        value: value,
        expire: Date.now() + this.ttl
      };
      localStorage.setItem('api_cache_' + key, JSON.stringify(data));
    } catch(e) {
      console.error('[Cache] Set error:', e);
    }
  },
  
  clear: function(key) {
    if (!key) {
      // Clear all API cache
      Object.keys(localStorage).forEach(function(k) {
        if (k.indexOf('api_cache_') === 0) {
          localStorage.removeItem(k);
        }
      });
    } else {
      localStorage.removeItem('api_cache_' + key);
    }
  },
  
  clearPattern: function(pattern) {
    Object.keys(localStorage).forEach(function(k) {
      if (k.indexOf('api_cache_') === 0 && k.indexOf(pattern) !== -1) {
        localStorage.removeItem(k);
      }
    });
  }
};

function callAPI(fnName, skipCache) {
  var args = Array.prototype.slice.call(arguments, 1);
  if (typeof args[args.length - 1] === 'boolean') {
    skipCache = args.pop();
  }

  // Generate cache key
  var cacheKey = fnName + '_' + JSON.stringify(args);

  // ── Check cache first (for GET operations) ──
  var readOnlyFunctions = ['getDashboardStats', 'getItems', 'getStock', 'getTransactions', 'getUsers', 'getSettings', 'getAssets', 'getItemDetail', 'getPendingRequests', 'getReports', 'getAssetStatus', 'getAssetCommittees'];
  if (!skipCache && readOnlyFunctions.indexOf(fnName) !== -1) {
    var cached = API_CACHE.get(cacheKey);
    if (cached) {
      console.log('[Cache] HIT:', fnName);
      return Promise.resolve(cached);
    }
    console.log('[Cache] MISS:', fnName);
  }

  // ── Mock path ──
  if (USE_MOCK) {
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        try {
          var mock = window._mockAPI;
          if (!mock || typeof mock[fnName] !== 'function') {
            console.warn('[Mock] ไม่พบ function:', fnName);
            resolve({ success: false, message: 'Mock: ไม่รองรับ ' + fnName });
            return;
          }
          var result = mock[fnName].apply(mock, args);
          // Cache read-only operations
          if (!skipCache && readOnlyFunctions.indexOf(fnName) !== -1 && result.success) {
            API_CACHE.set(cacheKey, result);
          }
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
  }).then(function(result) {
    // Cache read-only operations
    if (!skipCache && readOnlyFunctions.indexOf(fnName) !== -1 && result.success) {
      API_CACHE.set(cacheKey, result);
    }
    return result;
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
