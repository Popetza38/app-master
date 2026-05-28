// ============================================================
// API Client — Auto-routes to Mock (offline) or Google Apps Script (online)
// Enhanced: cache + in-flight dedupe + timeout/retry + request id + invalidation
// ============================================================

var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxehoF9YRI2_pPmE9htNfBVqC6AW71HaPrcCUN_P6522A4nfo3eKKvOumRgP_9Z7OF0Aw/exec';

// ── Mock mode ──────────────────────────────────────────────
var USE_MOCK = false;

var API_CFG = {
  CACHE_TTL_MS: 30000,
  TIMEOUT_MS: 12000,
  RETRY_COUNT: 1,
  RETRY_DELAY_MS: 350
};

var API_STATE = {
  cache: {},
  inflight: {},
  reqCounter: 0,
  metrics: { total:0, fail:0, timeout:0, network:0, http:0, auth:0, unknown:0, lastLatencyMs:0 }
};

function _apiNow() { return Date.now(); }
function _apiSleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }
function _apiReqId() { API_STATE.reqCounter += 1; return 'req_' + _apiNow() + '_' + API_STATE.reqCounter; }
function _apiKey(fnName, args) { return fnName + '::' + JSON.stringify(args || []); }
function _isGetLike(fnName) { return /^get/.test(fnName) || fnName === 'validateSession'; }
function _isMutation(fnName) { return /^(add|update|delete|save|approve|reject|cancel|toggle|change|reset)/.test(fnName); }

function _cacheGet(key) {
  var c = API_STATE.cache[key];
  if (!c) return null;
  if (_apiNow() > c.expireAt) { delete API_STATE.cache[key]; return null; }
  return c.value;
}
function _cacheSet(key, value, ttl) {
  API_STATE.cache[key] = { value: value, expireAt: _apiNow() + (ttl || API_CFG.CACHE_TTL_MS) };
}

var API_INVALIDATE_MAP = {
  addItem:['getItems','getDashboardStats','getTransactions'],
  updateItem:['getItems','getDashboardStats','getTransactions'],
  deleteItem:['getItems','getDashboardStats','getTransactions'],
  addReceive:['getItems','getReceives','getTransactions','getDashboardStats'],
  addWithdrawal:['getItems','getWithdrawals','getDashboardStats','getTransactions'],
  approveWithdrawal:['getItems','getWithdrawals','getDashboardStats','getTransactions'],
  rejectWithdrawal:['getItems','getWithdrawals','getDashboardStats','getTransactions'],
  cancelWithdrawal:['getItems','getWithdrawals','getDashboardStats','getTransactions'],
  addUser:['getUsers'],
  updateUser:['getUsers'],
  toggleUserActive:['getUsers'],
  resetUserPassword:['getUsers'],
  saveConfig:['getConfig','getDashboardStats'],
  saveAsset:['getAssets'],
  deleteAsset:['getAssets'],
  saveAssetCategory:['getAssetCategories'],
  deleteAssetCategory:['getAssetCategories'],
  saveAssetType:['getAssetTypes'],
  deleteAssetType:['getAssetTypes'],
  saveAmphoe:['getAmphoes'],
  deleteAmphoe:['getAmphoes'],
  saveAssetMaintenance:['getAssetMaintenance'],
  deleteAssetMaintenance:['getAssetMaintenance'],
  saveAssetStatusLog:['getAssetStatusLogs','getAssets'],
  saveAssetCommittee:['getAssetCommittees'],
  deleteAssetCommittee:['getAssetCommittees']
};

function invalidateAPICacheByFn(fnName) {
  if (!_isMutation(fnName)) return;
  var targets = API_INVALIDATE_MAP[fnName];
  if (!targets || targets.length === 0) {
    Object.keys(API_STATE.cache).forEach(function(k) { if (k.indexOf('get') === 0) delete API_STATE.cache[k]; });
    return;
  }
  Object.keys(API_STATE.cache).forEach(function(k) {
    for (var i=0; i<targets.length; i++) {
      if (k.indexOf(targets[i] + '::') === 0) { delete API_STATE.cache[k]; break; }
    }
  });
}

function _classifyError(err) {
  var msg = (err && err.message) ? err.message : String(err || 'unknown');
  if (/timeout/i.test(msg)) return 'timeout';
  if (/HTTP 401|HTTP 403|สิทธิ์|session|เข้าสู่ระบบ/i.test(msg)) return 'auth';
  if (/HTTP\s\d+/.test(msg)) return 'http';
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(msg)) return 'network';
  return 'unknown';
}

function _fetchWithTimeout(url, options, timeoutMs) {
  return new Promise(function(resolve, reject) {
    var done = false;
    var timer = setTimeout(function() {
      if (done) return;
      done = true;
      reject(new Error('timeout after ' + timeoutMs + 'ms'));
    }, timeoutMs);

    fetch(url, options).then(function(res) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(res);
    }).catch(function(err) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

function _callAPIInternal(fnName, args, reqId) {
  if (USE_MOCK) {
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        try {
          var mock = window._mockAPI;
          if (!mock || typeof mock[fnName] !== 'function') {
            resolve({ success: false, message: 'Mock: ไม่รองรับ ' + fnName });
            return;
          }
          resolve(mock[fnName].apply(mock, args));
        } catch (e) { reject(e); }
      }, 80);
    });
  }

  if (fnName === 'uploadFile') {
    var body = 'fn=' + encodeURIComponent(fnName) + '&args=' + encodeURIComponent(JSON.stringify(args));
    return _fetchWithTimeout(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Request-Id': reqId },
      body: body
    }, API_CFG.TIMEOUT_MS).then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  var url = APPS_SCRIPT_URL + '?fn=' + encodeURIComponent(fnName) + '&args=' + encodeURIComponent(JSON.stringify(args)) + '&rid=' + encodeURIComponent(reqId);
  return _fetchWithTimeout(url, { method: 'GET', mode: 'cors', headers: { 'X-Request-Id': reqId } }, API_CFG.TIMEOUT_MS).then(function(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  });
}

function callAPI(fnName) {
  var args = Array.prototype.slice.call(arguments, 1);
  var key = _apiKey(fnName, args);
  var reqId = _apiReqId();
  var startedAt = _apiNow();
  API_STATE.metrics.total += 1;

  if (_isGetLike(fnName)) {
    var cached = _cacheGet(key);
    if (cached) return Promise.resolve(cached);
  }

  if (API_STATE.inflight[key]) return API_STATE.inflight[key];

  var p = (function runWithRetry() {
    var attempts = 0;
    function once() {
      attempts += 1;
      return _callAPIInternal(fnName, args, reqId).catch(function(err) {
        var kind = _classifyError(err);
        var canRetry = _isGetLike(fnName) && attempts <= API_CFG.RETRY_COUNT && (kind === 'timeout' || kind === 'network' || kind === 'http');
        if (!canRetry) throw err;
        return _apiSleep(API_CFG.RETRY_DELAY_MS * attempts).then(once);
      });
    }
    return once();
  })().then(function(result) {
    API_STATE.metrics.lastLatencyMs = _apiNow() - startedAt;
    if (_isGetLike(fnName) && result && result.success !== false) {
      _cacheSet(key, result, API_CFG.CACHE_TTL_MS);
    }
    if (_isMutation(fnName)) invalidateAPICacheByFn(fnName);
    return result;
  }).catch(function(err) {
    var kind = _classifyError(err);
    API_STATE.metrics.fail += 1;
    API_STATE.metrics.lastLatencyMs = _apiNow() - startedAt;
    if (API_STATE.metrics[kind] !== undefined) API_STATE.metrics[kind] += 1;
    else API_STATE.metrics.unknown += 1;
    console.error('[API][' + reqId + '][' + kind + '] FAIL [' + fnName + ']:', err);
    throw err;
  }).finally(function() {
    delete API_STATE.inflight[key];
  });

  API_STATE.inflight[key] = p;
  return p;
}

// Helper: แปลง file_id เป็น URL สำหรับแสดงรูป
function getFileDataUrl(fileId) {
  if (!fileId) return '';
  if (String(fileId).indexOf('http') === 0 || String(fileId).indexOf('data:') === 0) return fileId;
  return 'https://lh5.googleusercontent.com/d/' + fileId;
}
