// ============================================================
// app.js — Frontend (Static Site)
// ============================================================

// callAPI ถูก define ใน api.js แล้ว

// ===== CONSTANTS =====
var ITEMS_PER_PAGE = 20;
var ROLE_LABELS = { admin:'ผู้ดูแลระบบ', staff:'เจ้าหน้าที่คลัง', employee:'พนักงาน' };

// ===== LOGIN PARTICLE ANIMATION =====
function initLoginParticles() {
  var container = document.getElementById('login-particles');
  if (!container) return;
  
  // Clear existing particles
  container.innerHTML = '';
  
  // Create particles
  var particleCount = 50;
  for (var i = 0; i < particleCount; i++) {
    var particle = document.createElement('div');
    particle.className = 'login-v2-particle';
    
    // Random properties
    var size = Math.random() * 4 + 2;
    var left = Math.random() * 100;
    var duration = Math.random() * 15 + 10;
    var delay = Math.random() * 15;
    
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = left + '%';
    particle.style.animationDuration = duration + 's';
    particle.style.animationDelay = delay + 's';
    
    container.appendChild(particle);
  }
}

// ===== BACKGROUND LOADING MANAGER =====
var BackgroundLoader = {
  cache: {},
  loadingQueue: [],
  isLoading: false,
  maxRetries: 3,
  retryDelay: 1000,
  
  // Load data with caching and retry
  load: function(key, loaderFn, forceRefresh) {
    var self = this;
    var cached = this.cache[key];
    
    // Return cached data if valid
    if (!forceRefresh && cached && cached.data && (Date.now() - cached.timestamp) < cached.ttl) {
      return Promise.resolve(cached.data);
    }
    
    // Add to queue if already loading
    if (this.loadingQueue.indexOf(key) !== -1) {
      return new Promise(function(resolve) {
        var checkInterval = setInterval(function() {
          if (self.loadingQueue.indexOf(key) === -1) {
            clearInterval(checkInterval);
            resolve(self.cache[key].data);
          }
        }, 100);
      });
    }
    
    // Start loading
    this.loadingQueue.push(key);
    return this._loadWithRetry(loaderFn, 0).then(function(data) {
      self.cache[key] = {
        data: data,
        timestamp: Date.now(),
        ttl: 60000 // 1 minute cache
      };
      var idx = self.loadingQueue.indexOf(key);
      if (idx !== -1) self.loadingQueue.splice(idx, 1);
      return data;
    }).catch(function(error) {
      var idx = self.loadingQueue.indexOf(key);
      if (idx !== -1) self.loadingQueue.splice(idx, 1);
      throw error;
    });
  },
  
  // Load with retry mechanism
  _loadWithRetry: function(loaderFn, retryCount) {
    var self = this;
    return loaderFn().catch(function(error) {
      if (retryCount < self.maxRetries) {
        return new Promise(function(resolve) {
          setTimeout(function() {
            resolve(self._loadWithRetry(loaderFn, retryCount + 1));
          }, self.retryDelay * (retryCount + 1));
        });
      }
      throw error;
    });
  },
  
  // Preload multiple data sources
  preload: function(loaders) {
    var self = this;
    var promises = [];
    var results = {};
    
    Object.keys(loaders).forEach(function(key) {
      promises.push(
        self.load(key, loaders[key]).then(function(data) {
          results[key] = data;
        }).catch(function(error) {
          results[key] = { error: error };
        })
      );
    });
    
    return Promise.all(promises).then(function() {
      return results;
    });
  },
  
  // Clear cache
  clearCache: function(key) {
    if (key) {
      delete this.cache[key];
    } else {
      this.cache = {};
    }
  },
  
  // Get loading status
  isLoadingKey: function(key) {
    return this.loadingQueue.indexOf(key) !== -1;
  }
};

// ===== DATA LOADERS WITH BACKGROUND LOADING =====
// Load items with background loading
function loadItemsBackground(forceRefresh) {
  return BackgroundLoader.load('items', function() {
    return callAPI('getItems', AUTH.token);
  }, forceRefresh).then(function(res) {
    if (res.success) {
      _itemsData = res.data || [];
      _itemsCacheTime = Date.now();
      updateLowStockBadge(_itemsData);
      return _itemsData;
    }
    throw new Error(res.message || 'Failed to load items');
  });
}

// Load stock data with background loading
function loadStockBackground(forceRefresh) {
  return BackgroundLoader.load('stock', function() {
    return callAPI('getItems', AUTH.token);
  }, forceRefresh).then(function(res) {
    if (res.success) {
      _itemsData = res.data || [];
      _stockData = res.data || [];
      _itemsCacheTime = Date.now();
      updateLowStockBadge(_itemsData);
      return _stockData;
    }
    throw new Error(res.message || 'Failed to load stock');
  });
}

// Load receives with background loading
function loadReceivesBackground(forceRefresh) {
  return BackgroundLoader.load('receives', function() {
    return callAPI('getReceives', AUTH.token, {});
  }, forceRefresh).then(function(res) {
    if (res.success) {
      _receiveData = res.data || [];
      return _receiveData;
    }
    throw new Error(res.message || 'Failed to load receives');
  });
}

// Load withdrawals with background loading
function loadWithdrawalsBackground(forceRefresh) {
  return BackgroundLoader.load('withdrawals', function() {
    return callAPI('getWithdrawals', AUTH.token, { status:'all' });
  }, forceRefresh).then(function(res) {
    if (res.success) {
      return res.data || [];
    }
    throw new Error(res.message || 'Failed to load withdrawals');
  });
}

// Load users with background loading
function loadUsersBackground(forceRefresh) {
  return BackgroundLoader.load('users', function() {
    return callAPI('getUsers', AUTH.token);
  }, forceRefresh).then(function(res) {
    if (res.success) {
      return res.data || [];
    }
    throw new Error(res.message || 'Failed to load users');
  });
}

// Load assets with background loading
function loadAssetsBackground(forceRefresh) {
  return BackgroundLoader.load('assets', function() {
    return callAPI('getAssets', AUTH.token);
  }, forceRefresh).then(function(res) {
    if (res.success) {
      _assetsCache = res.data || [];
      return _assetsCache;
    }
    throw new Error(res.message || 'Failed to load assets');
  });
}

// Preload all critical data after login
function preloadCriticalData() {
  var loaders = {
    items: function() { return callAPI('getItems', AUTH.token); },
    stock: function() { return callAPI('getItems', AUTH.token); },
    users: function() { return callAPI('getUsers', AUTH.token); }
  };
  
  return BackgroundLoader.preload(loaders).then(function(results) {
    if (results.items && results.items.success) {
      _itemsData = results.items.data || [];
      _itemsCacheTime = Date.now();
      updateLowStockBadge(_itemsData);
    }
    if (results.stock && results.stock.success) {
      _stockData = results.stock.data || [];
    }
    if (results.users && results.users.success) {
      // Users loaded successfully
    }
    return results;
  });
}

// ===== ERROR HANDLING FOR BACKGROUND LOADING =====
var ErrorHandler = {
  errors: {},
  
  // Log error
  log: function(key, error) {
    this.errors[key] = {
      error: error,
      timestamp: Date.now(),
      retryCount: 0
    };
    console.error('[BackgroundLoader] Error loading ' + key + ':', error);
  },
  
  // Get error for key
  get: function(key) {
    return this.errors[key];
  },
  
  // Clear error for key
  clear: function(key) {
    delete this.errors[key];
  },
  
  // Increment retry count
  incrementRetry: function(key) {
    if (this.errors[key]) {
      this.errors[key].retryCount++;
    }
  },
  
  // Show error UI
  showErrorUI: function(key, containerId, retryFn) {
    var error = this.get(key);
    if (!error) return;
    
    var container = document.getElementById(containerId);
    if (!container) return;
    
    var html = '<div class="bg-error-state">';
    html += '<i class="fi fi-rr-triangle-warning bg-error-icon"></i>';
    html += '<div>';
    html += '<div class="font-medium">โหลดข้อมูลไม่สำเร็จ</div>';
    html += '<div class="text-sm opacity-75">เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่</div>';
    html += '</div>';
    if (retryFn) {
      html += '<button class="bg-error-retry" onclick="' + retryFn + '">';
      html += '<i class="fi fi-rr-refresh mr-1"></i> ลองใหม่';
      html += '</button>';
    }
    html += '</div>';
    
    container.innerHTML = html;
  },
  
  // Show loading UI
  showLoadingUI: function(containerId, message) {
    var container = document.getElementById(containerId);
    if (!container) return;
    
    var html = '<div class="text-center py-8">';
    html += '<div class="inline-loading">';
    html += '<div class="inline-loading-spinner"></div>';
    html += '<span>' + (message || 'กำลังโหลด...') + '</span>';
    html += '</div>';
    html += '</div>';
    
    container.innerHTML = html;
  },
  
  // Show skeleton UI
  showSkeletonUI: function(containerId, type) {
    var container = document.getElementById(containerId);
    if (!container) return;
    
    var html = '';
    if (type === 'table') {
      for (var i = 0; i < 5; i++) {
        html += '<div class="skeleton-row"></div>';
      }
    } else if (type === 'card') {
      html += '<div class="skeleton-card"></div>';
    } else if (type === 'text') {
      html += '<div class="skeleton-text-lg"></div>';
      html += '<div class="skeleton-text"></div>';
      html += '<div class="skeleton-text"></div>';
      html += '<div class="skeleton-text-sm"></div>';
    }
    
    container.innerHTML = html;
  },
  
  // Show success UI
  showSuccessUI: function(containerId, message) {
    var container = document.getElementById(containerId);
    if (!container) return;
    
    var html = '<div class="bg-success-state">';
    html += '<i class="fi fi-rr-check-circle bg-success-icon"></i>';
    html += '<span>' + (message || 'โหลดข้อมูลสำเร็จ') + '</span>';
    html += '</div>';
    
    container.innerHTML = html;
  }
};

// ===== URL PARAMS (for QR / Public) =====
var _QR_ACTION = '';
var _QR_ITEM_ID = '';
var _QR_ASSET_ID = '';
var _PUBLIC_ASSET_ID = '';

// ===== AUTH =====
var AUTH = {
  token: localStorage.getItem('sup_token') || '',
  user:  JSON.parse(localStorage.getItem('sup_user')  || 'null'),
  set: function(token, user) {
    AUTH.token = token; AUTH.user = user;
    localStorage.setItem('sup_token', token);
    localStorage.setItem('sup_user', JSON.stringify(user));
  },
  clear: function() {
    AUTH.token = ''; AUTH.user = null;
    localStorage.removeItem('sup_token');
    localStorage.removeItem('sup_user');
  },
  hasRole: function(roles) {
    if (!AUTH.user) return false;
    if (!Array.isArray(roles)) roles = [roles];
    return roles.indexOf(AUTH.user.role) !== -1;
  }
};

// ===== LOADING =====
function showLoading(text) {
  document.getElementById('loadingText').textContent = text || 'กำลังโหลด...';
  document.getElementById('loadingOverlay').classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

// ===== ALERTS =====
function showSuccess(msg) { Swal.fire({ icon:'success', title:'สำเร็จ', text:msg, timer:2000, showConfirmButton:false, customClass:{popup:'swal2-popup'} }); }
function showError(msg)   { Swal.fire({ icon:'error', title:'เกิดข้อผิดพลาด', text:msg, customClass:{popup:'swal2-popup'} }); }
function showConfirm(title, text, cb, confirmText) {
  Swal.fire({
    title:title, text:text, icon:'warning', showCancelButton:true,
    confirmButtonText: confirmText||'ยืนยัน', cancelButtonText:'ยกเลิก',
    reverseButtons:true, customClass:{popup:'swal2-popup'}
  }).then(function(r){ if(r.isConfirmed) cb(); });
}

// ===== MODAL =====
function openModal(title, bodyHtml, footerHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFooter').innerHTML = footerHtml || '';
  document.getElementById('modalOverlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('modalBody').innerHTML = '';
  document.getElementById('modalFooter').innerHTML = '';
}

// ===== UTILITIES =====
function formatDate(iso) {
  if (!iso) return '-';
  var d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
}
function formatDateTime(iso) {
  if (!iso) return '-';
  var d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('th-TH', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function togglePass(inputId, btn) {
  var inp = document.getElementById(inputId);
  var isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  btn.querySelector('i').className = isPass ? 'fi fi-rr-eye-crossed text-sm' : 'fi fi-rr-eye text-sm';
}
function getStockClass(stock, min) {
  if (stock <= 0) return 'stock-critical';
  if (stock <= min) return 'stock-low';
  return 'stock-ok';
}
function getStockLabel(stock, min) {
  if (stock <= 0) return 'หมด';
  if (stock <= min) return 'ใกล้หมด';
  return 'ปกติ';
}
function imgUrl(fileId, size) {
  if (!fileId) return '';
  return getFileDataUrl(fileId) || '';
}

// ===== PAGINATION =====
function renderPagination(containerId, total, currentPage, onPageClick) {
  var totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  if (totalPages <= 1) { document.getElementById(containerId).innerHTML = ''; return; }
  var html = '<div class="flex items-center justify-between mt-4">';
  html += '<p class="text-xs text-gray-500">ทั้งหมด ' + total + ' รายการ</p>';
  html += '<div class="flex gap-1">';
  if (currentPage > 1) html += '<button class="page-btn" onclick="(' + onPageClick + ')(' + (currentPage-1) + ')"><i class="fi fi-rr-angle-left"></i></button>';
  var start = Math.max(1, currentPage-2), end = Math.min(totalPages, currentPage+2);
  for (var p = start; p <= end; p++) {
    html += '<button class="page-btn ' + (p===currentPage?'active':'') + '" onclick="(' + onPageClick + ')(' + p + ')">' + p + '</button>';
  }
  if (currentPage < totalPages) html += '<button class="page-btn" onclick="(' + onPageClick + ')(' + (currentPage+1) + ')"><i class="fi fi-rr-angle-right"></i></button>';
  html += '</div></div>';
  document.getElementById(containerId).innerHTML = html;
}

// ===== LOGIN =====
function doLogin() {
  var username = document.getElementById('loginUsername').value.trim();
  var password = document.getElementById('loginPassword').value;
  if (!username || !password) { showError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'); return; }
  var btn = document.getElementById('btnLogin');
  btn.disabled = true; btn.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> กำลังเข้าสู่ระบบ...';
  callAPI('login', username, password).then(function(res) {
    btn.disabled = false; btn.innerHTML = '<i class="fi fi-rr-sign-in"></i> เข้าสู่ระบบ';
    if (res.success) {
      AUTH.set(res.token, res.user);
      initApp();
    } else { showError(res.message); }
  }).catch(function(err) {
    btn.disabled = false; btn.innerHTML = '<i class="fi fi-rr-sign-in"></i> เข้าสู่ระบบ';
    showError('ไม่สามารถเชื่อมต่อระบบได้');
  });
}

function doLogout() {
  showConfirm('ออกจากระบบ', 'ต้องการออกจากระบบใช่หรือไม่?', function() {
    showLoading('กำลังออกจากระบบ...');
    callAPI('logout', AUTH.token).then(function() {
      AUTH.clear(); location.reload();
    });
  }, 'ออกจากระบบ');
}

function showForgotModal()  { document.getElementById('forgotModal').classList.remove('hidden'); }
function closeForgotModal() { document.getElementById('forgotModal').classList.add('hidden'); }
function submitForgotPassword() {
  var email = document.getElementById('forgotEmail').value.trim();
  if (!email) { showError('กรุณากรอกอีเมล'); return; }
  showLoading('กำลังส่งรหัสผ่านชั่วคราว...');
  callAPI('forgotPassword', email).then(function(res) {
    hideLoading(); closeForgotModal();
    if (res.success) showSuccess(res.message);
    else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}

// ===== APP INIT =====
function initApp() {
  showLoading('กำลังตรวจสอบสิทธิ์...');
  callAPI('validateSession', AUTH.token).then(function(session) {
    hideLoading();
    if (!session) { AUTH.clear(); showLoginPage(); return; }
    AUTH.user = { id: session.user_id, username: session.username, role: session.role, name: session.name };
    localStorage.setItem('sup_user', JSON.stringify(AUTH.user));
    showMainShell();
    loadPage('dashboard');
    
    // Background preload critical data
    preloadCriticalData().then(function(results) {
      console.log('[BackgroundLoader] Preload completed:', results);
    }).catch(function(error) {
      console.error('[BackgroundLoader] Preload failed:', error);
    });
    
    // Preload assets for global search
    if (AUTH.user.role !== 'employee') {
      _loadAssetsCache();
    }
    // QR action จาก URL
    if (_QR_ACTION === 'withdraw' && _QR_ITEM_ID) {
      setTimeout(function() { openWithdrawFromQR(_QR_ITEM_ID); }, 800);
    }
    if (_QR_ACTION === 'asset' && _QR_ASSET_ID) {
      setTimeout(function() {
        _loadAssetRefs(function() {
          callAPI('getAssets', AUTH.token).then(function(res) {
            _assetData = res.data || [];
            openAssetDetail(_QR_ASSET_ID);
          });
        });
      }, 800);
    }
  }).catch(function() { hideLoading(); showLoginPage(); });
}

function showLoginPage() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('mainShell').classList.add('hidden');
  // Initialize particles when showing login page
  initLoginParticles();
}

function showMainShell() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainShell').classList.remove('hidden');
  document.getElementById('sidebarName').textContent = AUTH.user.name || AUTH.user.username;
  document.getElementById('sidebarRole').textContent = ROLE_LABELS[AUTH.user.role] || AUTH.user.role;
  var isAdmin  = AUTH.user.role === 'admin';
  var isStaff  = AUTH.user.role === 'staff';
  var notEmp   = AUTH.user.role !== 'employee';
  document.getElementById('menuItems').style.display    = isAdmin ? '' : 'none';
  document.getElementById('menuReceive').style.display  = notEmp  ? '' : 'none';
  document.getElementById('menuStocktake').style.display = notEmp ? '' : 'none';
  document.getElementById('menuPrintQR').style.display   = notEmp ? '' : 'none';
  document.getElementById('menuInventorySection').style.display = notEmp ? '' : 'none';
  document.getElementById('menuApprove').style.display  = isAdmin ? '' : 'none';
  document.getElementById('menuAdminSection').style.display = isAdmin ? '' : 'none';
  document.getElementById('menuReportLabel').style.display  = notEmp ? '' : 'none';
  document.getElementById('menuReportSection').style.display= notEmp ? '' : 'none';
  document.getElementById('menuAssetSection').style.display   = notEmp ? '' : 'none';
  document.getElementById('menuAssets').style.display          = isAdmin ? '' : 'none';
  document.getElementById('menuAssetStatus').style.display   = notEmp ? '' : 'none';
  document.getElementById('menuAssetMaintenance').style.display = notEmp ? '' : 'none';
  document.getElementById('menuAssetCommittees').style.display = notEmp ? '' : 'none';
  document.getElementById('menuDepreciation').style.display = notEmp ? '' : 'none';
  document.getElementById('menuAssetRegister').style.display = notEmp ? '' : 'none';
  document.getElementById('menuAssetReports').style.display  = notEmp ? '' : 'none';
  document.getElementById('menuAssetReportSection').style.display = notEmp ? '' : 'none';
  initMenuSections();
  updateClock();
  setInterval(updateClock, 60000);
}

function updateClock() {
  var el = document.getElementById('topDateTime');
  if (el) el.textContent = new Date().toLocaleString('th-TH', { weekday:'short', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ===== NAVIGATION =====
var _currentPage = '';
var _pageCache   = {};

function loadPage(page) {
  _currentPage = page;
  document.querySelectorAll('.menu-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-page') === page);
  });
  expandActiveMenuSection(page);
  var titles = {
    dashboard:'ภาพรวมระบบ', stock:'สต็อกคงเหลือ', items:'รายการวัสดุ',
    receive:'รับวัสดุเข้าคลัง', stocktake:'นับสต็อก', printqr:'พิมพ์ QR สติ๊กเกอร์', withdraw:'เบิกวัสดุ', approve:'อนุมัติการเบิก',
    transactions:'ประวัติเคลื่อนไหว', reports:'รายงาน',
    users:'จัดการผู้ใช้งาน', settings:'ตั้งค่าระบบ', profile:'โปรไฟล์',
    assets:'ทะเบียนครุภัณฑ์', assetstatus:'อัปเดตสถานภาพ', assetmaintenance:'ซ่อมบำรุง',
    assetcommittees:'คณะกรรมการ', assetreports:'รายงานครุภัณฑ์', depreciation:'ค่าเสื่อม/อายุใช้งาน', assetregister:'ทะเบียนคุมสินทรัพย์', manual:'คู่มือการใช้งาน'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  document.getElementById('pageBreadcrumb').textContent = 'ระบบวัสดุสิ้นเปลือง / ' + (titles[page] || page);
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.add('hidden');
  var content = document.getElementById('mainContent');
  content.innerHTML = '<div class="flex items-center justify-center py-16"><div class="w-8 h-8 border-4 border-navy-600 border-t-transparent rounded-full animate-spin"></div></div>';
  // render ทันที ไม่ต้องรอ setTimeout
  if (page === 'dashboard')    renderDashboard();
  else if (page === 'stock')        renderStock();
  else if (page === 'items')        renderItems();
  else if (page === 'receive')      renderReceive();
  else if (page === 'stocktake')    renderStocktake();
  else if (page === 'printqr')      renderPrintQRLabels();
  else if (page === 'withdraw')     renderWithdraw();
  else if (page === 'approve')      renderApprove();
  else if (page === 'transactions') renderTransactions();
  else if (page === 'reports')      renderReports();
  else if (page === 'users')        renderUsers();
  else if (page === 'settings')     renderSettings();
  else if (page === 'profile')      renderProfile();
  else if (page === 'assets')             renderAssets();
  else if (page === 'assetstatus')        renderAssetStatus();
  else if (page === 'assetmaintenance')   renderAssetMaintenance();
  else if (page === 'assetcommittees')    renderAssetCommittees();
  else if (page === 'assetreports')       renderAssetReports();
  else if (page === 'depreciation')       renderDepreciation();
  else if (page === 'assetregister')        renderAssetRegister();
  else if (page === 'manual')               renderManual();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('hidden');
}

function toggleMenuSection(section) {
  var group = document.querySelector('.menu-group[data-section="' + section + '"]');
  if (!group) return;
  var collapsed = group.classList.toggle('collapsed');
  var state = JSON.parse(localStorage.getItem('menu_collapsed') || '{}');
  state[section] = collapsed;
  localStorage.setItem('menu_collapsed', JSON.stringify(state));
}

function initMenuSections() {
  var state = JSON.parse(localStorage.getItem('menu_collapsed') || '{}');
  document.querySelectorAll('.menu-group').forEach(function(group) {
    var section = group.getAttribute('data-section');
    if (state[section]) group.classList.add('collapsed');
    else group.classList.remove('collapsed');
  });
}

function renderManual() {
  function mCard(num, icon, iconBg, title, items) {
    var h = '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">';
    h += '<div class="flex items-center gap-3 px-5 py-4 border-b border-gray-100">';
    h += '<div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ' + iconBg + '">';
    h += '<i class="' + icon + ' text-white text-base"></i></div>';
    h += '<div><span class="text-xs text-gray-400 font-medium">ขั้นตอนที่ ' + num + '</span>';
    h += '<h4 class="text-sm font-bold text-gray-800 leading-tight">' + title + '</h4></div></div>';
    h += '<ul class="px-5 py-4 space-y-2.5">';
    items.forEach(function(item) {
      h += '<li class="flex items-start gap-2.5 text-sm text-gray-600">';
      h += '<span class="mt-1 w-1.5 h-1.5 rounded-full bg-navy-400 flex-shrink-0"></span>';
      h += '<span>' + item + '</span></li>';
    });
    h += '</ul></div>';
    return h;
  }

  var sections = [
    { num:1, icon:'fi fi-rr-sign-in', bg:'bg-blue-500', title:'การเข้าสู่ระบบ', items:[
      'เลือกบทบาท: <b class="text-navy-700">ผู้ดูแลระบบ</b> / <b class="text-navy-700">เจ้าหน้าที่</b> / <b class="text-navy-700">พนักงาน</b>',
      'กรอกชื่อผู้ใช้งานและรหัสผ่านที่ได้รับ',
      'กดปุ่ม <b>"เข้าสู่ระบบ"</b> หากลืมรหัสผ่านให้กด "ลืมรหัสผ่าน"'
    ]},
    { num:2, icon:'fi fi-rr-home', bg:'bg-indigo-500', title:'ภาพรวมระบบ (Dashboard)', items:[
      'ดูสรุปจำนวนวัสดุ สต็อกต่ำ/หมด รออนุมัติ และเคลื่อนไหววันนี้',
      'กราฟสถิติรับ-เบิก ย้อนหลัง 6 เดือนล่าสุด',
      'รายการวัสดุใกล้หมดสต็อกแบบ real-time'
    ]},
    { num:3, icon:'fi fi-rr-box-open-full', bg:'bg-cyan-500', title:'จัดการรายการวัสดุ', items:[
      '<b>เพิ่มวัสดุ:</b> กรอกชื่อ รหัส หมวดหมู่ หน่วยนับ จำนวนขั้นต่ำ และราคา',
      '<b>แก้ไข/ลบ:</b> คลิกไอคอนดินสอหรือถังขยะในตารางรายการ',
      '<b>อัปโหลดรูปภาพ:</b> กด "เลือกรูป" ในฟอร์มเพิ่ม/แก้ไข',
      '<b>พิมพ์ QR Code:</b> ไปที่เมนู "พิมพ์ QR สติ๊กเกอร์" เลือกวัสดุแล้วพิมพ์'
    ]},
    { num:4, icon:'fi fi-rr-layers', bg:'bg-teal-500', title:'สต็อกคงเหลือ', items:[
      'ดูสต็อกรายการวัสดุทั้งหมดแบบภาพรวม',
      'ตัวกรองตามหมวดหมู่และสถานะสต็อก',
      'สีแสดงสถานะ: <b class="text-green-600">ปกติ</b> / <b class="text-amber-500">ใกล้หมด</b> / <b class="text-red-600">หมด</b>'
    ]},
    { num:5, icon:'fi fi-rr-inbox-in', bg:'bg-green-500', title:'รับวัสดุเข้าคลัง', items:[
      'เลือกวัสดุที่ต้องการรับเข้า',
      'กรอกจำนวนที่รับเข้า ระบุผู้รับและเลขที่เอกสาร',
      'ระบบบันทึกประวัติและเพิ่มจำนวนสต็อกอัตโนมัติ'
    ]},
    { num:6, icon:'fi fi-rr-inbox-out', bg:'bg-orange-500', title:'เบิกวัสดุ', items:[
      'ค้นหาวัสดุที่ต้องการ หรือสแกน QR Code บนสติ๊กเกอร์',
      'กรอกจำนวนที่ต้องการเบิก เลือกผู้รับและหน่วยงาน',
      'ส่งคำขอเบิก → รอผู้ดูแลระบบอนุมัติก่อนหักสต็อก'
    ]},
    { num:7, icon:'fi fi-rr-check-circle', bg:'bg-emerald-500', title:'อนุมัติการเบิก (เฉพาะผู้ดูแลระบบ)', items:[
      'เข้าเมนู "อนุมัติการเบิก" เพื่อดูรายการที่รอดำเนินการ',
      'กด ✓ เพื่ออนุมัติ หรือ ✗ เพื่อปฏิเสธพร้อมระบุเหตุผล',
      'เมื่ออนุมัติ ระบบหักสต็อกและบันทึกประวัติอัตโนมัติ'
    ]},
    { num:8, icon:'fi fi-rr-box-alt', bg:'bg-amber-500', title:'ทะเบียนครุภัณฑ์', items:[
      '<b>เพิ่มครุภัณฑ์:</b> กรอกรหัส ชื่อ ประเภท หน่วยงาน ราคา วันที่รับเข้า',
      '<b>อัปเดตสถานภาพ:</b> เปลี่ยนสถานะเป็น ใช้งาน / ชำรุด / จำหน่าย',
      '<b>ซ่อมบำรุง:</b> บันทึกประวัติการซ่อมและค่าใช้จ่ายแต่ละครั้ง',
      '<b>ค่าเสื่อม:</b> ดูตารางค่าเสื่อมราคาคำนวณอัตโนมัติตามอายุใช้งาน',
      '<b>ทะเบียนคุมฯ:</b> พิมพ์แบบฟอร์มรายตัวพร้อม QR Code'
    ]},
    { num:9, icon:'fi fi-rr-chart-histogram', bg:'bg-violet-500', title:'รายงาน', items:[
      'รายงานการตรวจสอบพัสดุประจำปีงบประมาณ',
      'รายงานการเบิก-รับ แยกตามหมวดหมู่และเดือน',
      'รายงานครุภัณฑ์: ตามสถานะ / ตามหน่วยงาน',
      'พิมพ์เป็น PDF หรือ export ไฟล์ Excel'
    ]},
    { num:10, icon:'fi fi-rr-settings', bg:'bg-slate-500', title:'ตั้งค่าระบบ', items:[
      '<b>ข้อมูลองค์กร:</b> ชื่อระบบ โลโก้ ชื่อองค์กร ปีงบประมาณ',
      '<b>จัดการผู้ใช้:</b> เพิ่ม/แก้ไข/ลบ ผู้ใช้งานและกำหนดสิทธิ์',
      '<b>หมวดหมู่:</b> จัดการหมวดหมู่วัสดุและประเภทครุภัณฑ์'
    ]},
    { num:11, icon:'fi fi-rr-bulb', bg:'bg-yellow-500', title:'เคล็ดลับการใช้งาน', items:[
      'ใช้ช่อง <b>"ค้นหาเร็ว"</b> บนแถบด้านบนเพื่อหาวัสดุหรือครุภัณฑ์ได้ทันที',
      'สแกน QR Code บนสติ๊กเกอร์เพื่อเบิกวัสดุโดยตรง ไม่ต้องค้นหา',
      'สแกน QR ครุภัณฑ์เพื่อดูรายละเอียดแบบสาธารณะได้ทันที',
      'ข้อมูลสต็อกอัปเดต real-time ทุกครั้งที่มีการรับ/เบิก'
    ]}
  ];

  var html = '<div class="fade-in">';

  // Hero header
  html += '<div class="bg-gradient-to-r from-navy-800 to-navy-600 rounded-2xl p-6 mb-6 text-white">';
  html += '<div class="flex items-center gap-4">';
  html += '<div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0"><i class="fi fi-rr-book text-white text-2xl"></i></div>';
  html += '<div><h2 class="text-xl font-bold">คู่มือการใช้งาน</h2>';
  html += '<p class="text-blue-200 text-sm mt-1">ระบบบริหารจัดการวัสดุสิ้นเปลืองและครุภัณฑ์</p></div></div>';
  html += '<div class="grid grid-cols-3 gap-3 mt-5">';
  html += '<div class="bg-white/10 rounded-xl p-3 text-center"><div class="text-lg font-bold">11</div><div class="text-xs text-blue-200">หัวข้อ</div></div>';
  html += '<div class="bg-white/10 rounded-xl p-3 text-center"><div class="text-lg font-bold">3</div><div class="text-xs text-blue-200">บทบาทผู้ใช้</div></div>';
  html += '<div class="bg-white/10 rounded-xl p-3 text-center"><div class="text-lg font-bold">QR</div><div class="text-xs text-blue-200">สแกนได้ทันที</div></div>';
  html += '</div></div>';

  // Roles info bar
  html += '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">';
  html += '<div class="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3"><i class="fi fi-rr-shield-check text-blue-600 text-lg"></i><div><p class="text-xs font-bold text-blue-700">ผู้ดูแลระบบ</p><p class="text-xs text-blue-500">เข้าถึงได้ทุกเมนู อนุมัติ จัดการผู้ใช้</p></div></div>';
  html += '<div class="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-3"><i class="fi fi-rr-user-gear text-green-600 text-lg"></i><div><p class="text-xs font-bold text-green-700">เจ้าหน้าที่</p><p class="text-xs text-green-500">รับ-เบิกวัสดุ ดูรายงาน จัดการครุภัณฑ์</p></div></div>';
  html += '<div class="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center gap-3"><i class="fi fi-rr-user text-amber-600 text-lg"></i><div><p class="text-xs font-bold text-amber-700">พนักงาน</p><p class="text-xs text-amber-500">เบิกวัสดุ ดูสต็อกคงเหลือ</p></div></div>';
  html += '</div>';

  // Cards grid
  html += '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">';
  sections.forEach(function(s) {
    html += mCard(s.num, s.icon, s.bg, s.title, s.items);
  });
  html += '</div></div>';

  document.getElementById('mainContent').innerHTML = html;
}

function expandActiveMenuSection(page) {
  var map = {
    dashboard: 'main', stock: 'main',
    items: 'inventory', receive: 'inventory', stocktake: 'inventory', printqr: 'inventory',
    withdraw: 'withdraw', approve: 'withdraw', transactions: 'withdraw',
    reports: 'report',
    assets: 'asset', assetstatus: 'asset', assetmaintenance: 'asset', assetcommittees: 'asset', depreciation: 'asset', assetregister: 'asset',
    assetreports: 'assetreport',
    users: 'admin', settings: 'admin', manual: 'manual'
  };
  var section = map[page];
  if (!section) return;
  var group = document.querySelector('.menu-group[data-section="' + section + '"]');
  if (group) group.classList.remove('collapsed');
}

// ===== GLOBAL SEARCH =====
var _globalSearchTimer;
var _assetsCache = [];
function _loadAssetsCache(callback) {
  if (_assetsCache.length > 0) { if (callback) callback(); return; }
  if (!AUTH.token) { if (callback) callback(); return; }
  callAPI('getAssets', AUTH.token).then(function(res) {
    _assetsCache = res.data || [];
    if (callback) callback();
  }).catch(function() { if (callback) callback(); });
}
function debounceGlobalSearch() {
  clearTimeout(_globalSearchTimer);
  _globalSearchTimer = setTimeout(performGlobalSearch, 300);
}
function performGlobalSearch() {
  var q = (document.getElementById('globalSearch')||{}).value||'';
  var resultsDiv = document.getElementById('globalSearchResults');
  if (!q || q.length < 2) { resultsDiv.classList.add('hidden'); return; }
  var term = q.toLowerCase();
  var matches = [];
  // Items
  (_itemsData || []).forEach(function(i) {
    if (i.active === false) return;
    if ((i.name||'').toLowerCase().includes(term) || (i.item_code||'').toLowerCase().includes(term) || (i.category||'').toLowerCase().includes(term)) {
      matches.push({ type: 'item', id: i.id, name: i.name, code: i.item_code, sub: 'คงเหลือ ' + (i.current_stock||0) + ' ' + (i.unit||''), image: i.image_file_id });
    }
  });
  // Assets
  (_assetsCache || []).forEach(function(a) {
    if ((a.asset_code||'').toLowerCase().includes(term) || (a.description||'').toLowerCase().includes(term) || (a.serial_number||'').toLowerCase().includes(term) || (a.gfmis_number||'').toLowerCase().includes(term)) {
      matches.push({ type: 'asset', id: a.id, name: a.description || a.asset_code, code: a.asset_code, sub: a.serial_number || a.status || '', image: null });
    }
  });
  matches = matches.slice(0, 10);
  if (matches.length === 0) { resultsDiv.classList.add('hidden'); return; }
  var html = '';
  matches.forEach(function(m) {
    var iconClass = m.type === 'asset' ? 'fi fi-rr-box-alt' : 'fi fi-rr-box-open-full';
    var label = m.type === 'asset' ? 'ครุภัณฑ์' : 'วัสดุ';
    var imgHtml = m.image ? '<img src="' + imgUrl(m.image) + '" class="w-8 h-8 object-cover rounded-lg border border-gray-200" loading="lazy">' : '<div class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"><i class="' + iconClass + ' text-gray-400 text-xs"></i></div>';
    html += '<div class="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0" onclick="globalSearchGoTo(\'' + m.id + '\',\'' + m.type + '\')">';
    html += imgHtml;
    html += '<div class="flex-1 min-w-0"><p class="text-sm font-medium text-gray-800 truncate">' + escHtml(m.name) + '</p>';
    html += '<p class="text-xs text-gray-500">' + escHtml(m.code||'') + ' • ' + escHtml(m.sub) + ' <span class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ' + (m.type==='asset'?'bg-amber-50 text-amber-700':'bg-blue-50 text-blue-700') + '">' + label + '</span></p></div>';
    html += '<i class="fi fi-rr-angle-right text-gray-400 text-xs"></i></div>';
  });
  resultsDiv.innerHTML = html;
  resultsDiv.classList.remove('hidden');
}
function globalSearchGoTo(id, type) {
  document.getElementById('globalSearch').value = '';
  document.getElementById('globalSearchResults').classList.add('hidden');
  if (type === 'asset') {
    _loadAssetRefs(function() {
      callAPI('getAssets', AUTH.token).then(function(res) {
        _assetData = res.data || [];
        openAssetDetail(id);
      }).catch(function() { showError('โหลดข้อมูลครุภัณฑ์ไม่สำเร็จ'); });
    });
  } else {
    showItemDetailModal(id);
  }
}
// ปิด dropdown เมื่อ click นอก
window.addEventListener('click', function(e) {
  var gs = document.getElementById('globalSearch');
  var gr = document.getElementById('globalSearchResults');
  if (gs && gr && !gs.contains(e.target) && !gr.contains(e.target)) {
    gr.classList.add('hidden');
  }
});

// ===== DASHBOARD =====
var _charts = {};

function renderDashboard() {
  showLoading('โหลดข้อมูล Dashboard...');
  Promise.all([
    callAPI('getDashboardStats', AUTH.token),
    callAPI('getWithdrawals', AUTH.token, { status:'approved' })
  ]).then(function(results) {
    hideLoading();
    var res = results[0];
    var wdRes = results[1];
    if (!res.success) { showError(res.message); return; }
    var d  = res;
    var kpi= res.kpi;
    var withdrawals = (wdRes.data || []).filter(function(w){ return w.status === 'approved'; });

    var badge = document.getElementById('pendingBadge');
    if (kpi.pending > 0) { badge.textContent = kpi.pending; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }

    var lowBadge = document.getElementById('lowStockBadge');
    if (kpi.low_stock > 0) { lowBadge.textContent = kpi.low_stock; lowBadge.classList.remove('hidden'); }
    else { lowBadge.classList.add('hidden'); }

    var html = '<div class="fade-in space-y-5">';

    if (d.low_stock_items && d.low_stock_items.length > 0) {
      html += '<div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">';
      html += '<i class="fi fi-rr-triangle-warning text-amber-500 text-lg mt-0.5 flex-shrink-0"></i>';
      html += '<div class="flex-1">';
      html += '<p class="font-semibold text-amber-800 text-sm">วัสดุใกล้หมด/หมดสต็อก</p>';
      html += '<p class="text-xs text-amber-700 mt-1">' + d.low_stock_items.map(function(i){ return i.name + ' (เหลือ ' + i.current_stock + ' ' + i.unit + ')'; }).join(' • ') + '</p>';
      html += '</div></div>';
    }

    // ── วัสดุ KPI ──
    html += '<div class="flex items-center justify-between mb-2">';
    html += '<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><i class="fi fi-rr-box-open-full text-blue-500"></i> วัสดุสิ้นเปลือง</p>';
    html += '<button onclick="loadPage(\'stock\')" class="text-xs text-navy-600 hover:underline">ดูสต็อก →</button></div>';
    html += '<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">';
    var kpis = [
      { label:'รายการวัสดุ', value:kpi.total_items, icon:'fi-rr-box-open-full', color:'bg-blue-100', iconColor:'text-blue-600', danger:false },
      { label:'สต็อกต่ำ/หมด', value:kpi.low_stock, icon:'fi-rr-triangle-warning', color:'bg-amber-100', iconColor:'text-amber-600', danger: kpi.low_stock > 0 },
      { label:'รออนุมัติ', value:kpi.pending, icon:'fi-rr-time-forward', color:'bg-purple-100', iconColor:'text-purple-600', danger: kpi.pending > 0 },
      { label:'เคลื่อนไหววันนี้', value:kpi.today_tx, icon:'fi-rr-activity', color:'bg-green-100', iconColor:'text-green-600', danger:false }
    ];
    kpis.forEach(function(k) {
      html += '<div class="card kpi-card p-4">';
      html += '<div class="flex items-center justify-between mb-3">';
      html += '<div class="w-11 h-11 ' + k.color + ' rounded-xl flex items-center justify-center"><i class="fi ' + k.icon + ' ' + k.iconColor + ' text-xl"></i></div>';
      if (k.danger && k.value > 0) html += '<span class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">!</span>';
      html += '</div>';
      html += '<p class="text-2xl font-bold text-gray-800">' + k.value + '</p>';
      html += '<p class="text-xs text-gray-500 mt-0.5">' + k.label + '</p>';
      html += '</div>';
    });
    html += '</div>';

    // ── ครุภัณฑ์ KPI ──
    html += '<div class="flex items-center justify-between mb-2 mt-1">';
    html += '<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><i class="fi fi-rr-box-alt text-amber-500"></i> ครุภัณฑ์</p>';
    html += '<button onclick="loadPage(\'assets\')" class="text-xs text-navy-600 hover:underline">ดูทะเบียน →</button></div>';
    html += '<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">';
    var assetKpis = [
      { label:'ครุภัณฑ์ทั้งหมด', value: kpi.asset_total||0, icon:'fi-rr-box-alt', color:'bg-amber-100', iconColor:'text-amber-600', danger:false },
      { label:'กำลังใช้งาน', value: kpi.asset_active||0, icon:'fi-rr-check-circle', color:'bg-green-100', iconColor:'text-green-600', danger:false },
      { label:'ชำรุด', value: kpi.asset_damaged||0, icon:'fi-rr-wrench', color:'bg-red-100', iconColor:'text-red-500', danger: (kpi.asset_damaged||0) > 0 },
      { label:'จำหน่ายแล้ว', value: kpi.asset_disposed||0, icon:'fi-rr-trash', color:'bg-gray-100', iconColor:'text-gray-500', danger:false }
    ];
    assetKpis.forEach(function(k) {
      html += '<div class="card kpi-card p-4">';
      html += '<div class="flex items-center justify-between mb-3">';
      html += '<div class="w-11 h-11 ' + k.color + ' rounded-xl flex items-center justify-center"><i class="fi ' + k.icon + ' ' + k.iconColor + ' text-xl"></i></div>';
      if (k.danger && k.value > 0) html += '<span class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">!</span>';
      html += '</div>';
      html += '<p class="text-2xl font-bold text-gray-800">' + k.value + '</p>';
      html += '<p class="text-xs text-gray-500 mt-0.5">' + k.label + '</p>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="card">';
    html += '<div class="card-header"><h3 class="font-semibold text-gray-700 text-sm flex items-center gap-2"><i class="fi fi-rr-arrow-right text-navy-600"></i> Workflow การเบิกวัสดุ</h3></div>';
    html += '<div class="card-body"><div class="flex items-center justify-center gap-2 flex-wrap">';
    var wfSteps = [
      { label:'ยื่นขอ', color:'bg-blue-500', icon:'fi-rr-inbox-out' },
      { label:'รออนุมัติ', color:'bg-amber-500', icon:'fi-rr-time-forward' },
      { label:'อนุมัติ', color:'bg-green-500', icon:'fi-rr-check-circle' },
      { label:'จ่ายวัสดุ', color:'bg-purple-500', icon:'fi-rr-hand-holding-box' },
      { label:'เสร็จสิ้น', color:'bg-teal-500', icon:'fi-rr-badge-check' }
    ];
    var wfCounts = [kpi.pending + (kpi.today_tx||0), kpi.pending, 0, kpi.today_tx, 0];
    wfSteps.forEach(function(s, i) {
      html += '<div class="text-center"><div class="wf-bubble ' + s.color + ' mx-auto"><i class="fi ' + s.icon + ' text-base"></i></div>';
      html += '<p class="text-xs text-gray-600 mt-1">' + s.label + '</p>';
      html += '<p class="text-sm font-bold text-navy-700">' + (wfCounts[i]||0) + '</p></div>';
      if (i < wfSteps.length-1) html += '<i class="fi fi-rr-angle-right wf-arrow mt-3"></i>';
    });
    html += '</div></div></div>';

    html += '<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">';
    html += '<div class="card lg:col-span-2"><div class="card-header"><h3 class="font-semibold text-gray-700 text-sm flex items-center gap-2"><i class="fi fi-rr-chart-histogram text-navy-600"></i> สถิติรับ-เบิก 6 เดือนล่าสุด</h3></div>';
    html += '<div class="card-body"><div style="position:relative;height:220px"><canvas id="chartMonthly"></canvas></div></div></div>';
    html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 text-sm flex items-center gap-2"><i class="fi fi-rr-chart-pie text-navy-600"></i> สัดส่วนวัสดุ</h3></div>';
    html += '<div class="card-body"><div style="position:relative;height:220px"><canvas id="chartCategory"></canvas></div></div></div>';
    html += '</div>';

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
    html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 text-sm flex items-center gap-2"><i class="fi fi-rr-chart-line text-navy-600"></i> เทรนด์การเบิกรายเดือน</h3></div>';
    html += '<div class="card-body"><div style="position:relative;height:220px"><canvas id="chartWdTrend"></canvas></div></div></div>';
    html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 text-sm flex items-center gap-2"><i class="fi fi-rr-chart-bar text-navy-600"></i> การเบิกตามหมวดหมู่</h3></div>';
    html += '<div class="card-body"><div style="position:relative;height:220px"><canvas id="chartWdCat"></canvas></div></div></div>';
    html += '</div>';

    html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

    html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 text-sm">รายการเคลื่อนไหวล่าสุด</h3>';
    html += '<button onclick="loadPage(\'transactions\')" class="text-xs text-navy-600 hover:underline">ดูทั้งหมด</button></div>';
    html += '<div class="card-body p-0"><div class="divide-y">';
    if (d.recent_transactions && d.recent_transactions.length > 0) {
      d.recent_transactions.slice(0,6).forEach(function(t) {
        var isR = t.type === 'receive';
        html += '<div class="flex items-center gap-3 px-4 py-3">';
        html += '<div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ' + (isR ? 'bg-blue-100':'bg-purple-100') + '">';
        html += '<i class="fi ' + (isR?'fi-rr-inbox-in text-blue-600':'fi-rr-inbox-out text-purple-600') + ' text-sm"></i></div>';
        html += '<div class="flex-1 min-w-0"><p class="text-xs font-medium text-gray-700 truncate">' + escHtml(t.item_name) + '</p>';
        html += '<p class="text-xs text-gray-400">' + (isR?'+':'-') + t.quantity + ' ' + t.unit + ' • ' + (t.actor_name||'-') + '</p></div>';
        html += '<span class="text-xs text-gray-400 flex-shrink-0">' + formatDate(t.date) + '</span></div>';
      });
    } else { html += '<p class="text-center text-xs text-gray-400 py-6">ยังไม่มีรายการ</p>'; }
    html += '</div></div></div>';

    html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 text-sm">คำขอเบิกรออนุมัติ</h3>';
    if (AUTH.user.role === 'admin') html += '<button onclick="loadPage(\'approve\')" class="text-xs text-navy-600 hover:underline">จัดการ</button>';
    html += '</div><div class="card-body p-0"><div class="divide-y">';
    if (d.recent_pending && d.recent_pending.length > 0) {
      d.recent_pending.forEach(function(w) {
        html += '<div class="flex items-center gap-3 px-4 py-3">';
        html += '<div class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0"><i class="fi fi-rr-time-forward text-amber-600 text-sm"></i></div>';
        html += '<div class="flex-1 min-w-0"><p class="text-xs font-medium text-gray-700 truncate">' + escHtml(w.item_name) + '</p>';
        html += '<p class="text-xs text-gray-400">' + w.quantity_requested + ' ' + w.unit + ' • ' + escHtml(w.requested_by_name) + '</p></div>';
        if (AUTH.user.role === 'admin') {
          html += '<div class="flex gap-1 flex-shrink-0">';
          html += '<button onclick="quickApprove(\'' + w.id + '\',' + w.quantity_requested + ')" class="btn-success btn-sm text-xs px-2 py-1 rounded-lg"><i class="fi fi-rr-check"></i></button>';
          html += '<button onclick="quickReject(\'' + w.id + '\')" class="btn-danger btn-sm text-xs px-2 py-1 rounded-lg"><i class="fi fi-rr-cross"></i></button></div>';
        }
        html += '</div>';
      });
    } else { html += '<p class="text-center text-xs text-gray-400 py-6">ไม่มีคำขอรออนุมัติ</p>'; }
    html += '</div></div></div>';

    html += '</div>';

    if (d.top_items && d.top_items.length > 0) {
      html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 text-sm flex items-center gap-2"><i class="fi fi-rr-star text-amber-500"></i> Top 5 วัสดุที่เบิกมากสุด</h3></div>';
      html += '<div class="card-body space-y-3">';
      var maxQty = d.top_items[0].qty || 1;
      d.top_items.forEach(function(item, idx) {
        var pct = Math.round(item.qty / maxQty * 100);
        html += '<div class="flex items-center gap-3">';
        html += '<span class="text-xs font-bold text-gray-400 w-4 text-right">' + (idx+1) + '</span>';
        html += '<div class="flex-1"><p class="text-xs font-medium text-gray-700 mb-1 truncate">' + escHtml(item.name) + '</p>';
        html += '<div class="progress-bar"><div class="progress-fill bg-navy-600" style="width:' + pct + '%"></div></div></div>';
        html += '<span class="text-xs font-bold text-navy-700 w-8 text-right">' + item.qty + '</span></div>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    document.getElementById('mainContent').innerHTML = html;

    setTimeout(function() {
      if (_charts.monthly) _charts.monthly.destroy();
      var ctxM = document.getElementById('chartMonthly');
      if (ctxM) {
        _charts.monthly = new Chart(ctxM, {
          type:'bar',
          data:{
            labels: d.monthly.map(function(m){ return m.label; }),
            datasets:[
              { label:'รับเข้า', data:d.monthly.map(function(m){ return m.receive; }), backgroundColor:'#3b82f6', borderRadius:6, barPercentage:0.6 },
              { label:'เบิกออก', data:d.monthly.map(function(m){ return m.withdraw; }), backgroundColor:'#8b5cf6', borderRadius:6, barPercentage:0.6 }
            ]
          },
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top',labels:{font:{family:'Sarabun',size:11},boxWidth:12}}}, scales:{y:{ticks:{font:{family:'Sarabun',size:11}},grid:{color:'#f3f4f6'}},x:{ticks:{font:{family:'Sarabun',size:11}},grid:{display:false}}} }
        });
      }
      if (_charts.category) _charts.category.destroy();
      var ctxC = document.getElementById('chartCategory');
      if (ctxC && d.category_stock) {
        var cats = Object.keys(d.category_stock);
        var vals = cats.map(function(k){ return d.category_stock[k]; });
        var colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899'];
        _charts.category = new Chart(ctxC, {
          type:'doughnut',
          data:{ labels:cats, datasets:[{ data:vals, backgroundColor:colors.slice(0,cats.length), borderWidth:0, hoverOffset:6 }] },
          options:{ responsive:true, maintainAspectRatio:false, cutout:'65%', plugins:{ legend:{position:'bottom',labels:{font:{family:'Sarabun',size:10},boxWidth:10,padding:8}} } }
        });
      }
      // Withdrawal trend line chart
      if (_charts.wdTrend) _charts.wdTrend.destroy();
      var ctxT = document.getElementById('chartWdTrend');
      if (ctxT && d.monthly) {
        _charts.wdTrend = new Chart(ctxT, {
          type:'line',
          data:{
            labels: d.monthly.map(function(m){ return m.label; }),
            datasets:[{
              label:'เบิกออก',
              data:d.monthly.map(function(m){ return m.withdraw; }),
              borderColor:'#8b5cf6',
              backgroundColor:'rgba(139,92,246,0.15)',
              fill:true,
              tension:0.3,
              pointRadius:4,
              pointBackgroundColor:'#8b5cf6'
            }]
          },
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{ticks:{font:{family:'Sarabun',size:11}},grid:{color:'#f3f4f6'}},x:{ticks:{font:{family:'Sarabun',size:11}},grid:{display:false}}} }
        });
      }
      // Category withdrawal bar chart
      if (_charts.wdCat) _charts.wdCat.destroy();
      var ctxW = document.getElementById('chartWdCat');
      if (ctxW && withdrawals.length > 0) {
        var catTotals = {};
        withdrawals.forEach(function(w){
          var item = _itemsData.find(function(i){ return i.id === w.item_id; });
          var cat = item ? (item.category || 'ไม่ระบุหมวด') : 'ไม่ระบุหมวด';
          catTotals[cat] = (catTotals[cat] || 0) + (w.quantity || 0);
        });
        var catKeys = Object.keys(catTotals).sort(function(a,b){ return catTotals[b] - catTotals[a]; }).slice(0,6);
        var catVals = catKeys.map(function(k){ return catTotals[k]; });
        var barColors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];
        _charts.wdCat = new Chart(ctxW, {
          type:'bar',
          data:{ labels:catKeys, datasets:[{ label:'จำนวนเบิก', data:catVals, backgroundColor:barColors.slice(0,catKeys.length), borderRadius:6, barPercentage:0.6 }] },
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){ return c.raw + ' รายการ'; }}}}, scales:{y:{ticks:{font:{family:'Sarabun',size:11}},grid:{color:'#f3f4f6'}},x:{ticks:{font:{family:'Sarabun',size:10}},grid:{display:false}}} }
        });
      } else if (ctxW) {
        // ถ้าไม่มีข้อมูลการเบิก แสดงข้อความ
        ctxW.parentNode.innerHTML = '<div class="flex items-center justify-center h-full text-sm text-gray-400">ยังไม่มีข้อมูลการเบิก</div>';
      }
    }, 100);

  }).catch(function(err) { hideLoading(); showError('โหลด Dashboard ไม่สำเร็จ'); });
}

function quickApprove(wdId, qty) {
  showConfirm('อนุมัติการเบิก', 'ยืนยันอนุมัติ ' + qty + ' รายการ?', function() {
    showLoading('กำลังอนุมัติ...');
    callAPI('approveWithdrawal', AUTH.token, wdId, qty).then(function(res) {
      hideLoading();
      if (res.success) { showSuccess('อนุมัติสำเร็จ'); renderDashboard(); }
      else showError(res.message);
    }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
  }, 'อนุมัติ');
}

function quickReject(wdId) {
  Swal.fire({
    title:'เหตุผลที่ปฏิเสธ', input:'text', inputPlaceholder:'ระบุเหตุผล...',
    showCancelButton:true, confirmButtonText:'ปฏิเสธ', cancelButtonText:'ยกเลิก',
    inputValidator:function(v){ if(!v) return 'กรุณาระบุเหตุผล'; },
    customClass:{popup:'swal2-popup'}
  }).then(function(r) {
    if (!r.isConfirmed) return;
    showLoading('กำลังดำเนินการ...');
    callAPI('rejectWithdrawal', AUTH.token, wdId, r.value).then(function(res) {
      hideLoading();
      if (res.success) { showSuccess('ปฏิเสธคำขอแล้ว'); renderDashboard(); }
      else showError(res.message);
    }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
  });
}

// ===== ITEMS =====
var _itemsData = [];
var _itemsPage = 1;
var _itemsFilter = { search:'', category:'all', stock:'all' };
var _itemImageFileId = null;
var _itemsCacheTime = 0;
var _configLogoFileId = null;
var ITEMS_CACHE_TTL = 30000; // 30 วินาที

function renderItems() {
  if (AUTH.user.role !== 'admin') { loadPage('stock'); return; }
  showLoading('โหลดรายการวัสดุ...');
  // reuse cache ถ้ายังไม่หมดอายุ
  if (_itemsData.length > 0 && (Date.now() - _itemsCacheTime) < ITEMS_CACHE_TTL) {
    hideLoading();
    updateLowStockBadge(_itemsData);
    _itemsPage = 1;
    buildItemsPage();
    return;
  }
  callAPI('getItems', AUTH.token).then(function(res) {
    hideLoading();
    if (!res.success) { showError(res.message); return; }
    _itemsData = res.data;
    _itemsCacheTime = Date.now();
    updateLowStockBadge(_itemsData);
    _itemsPage  = 1;
    buildItemsPage();
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildItemsPage() {
  var filtered = filterItems(_itemsData, _itemsFilter);
  var paged    = paginate(filtered, _itemsPage);
  var cats     = getCategoryList(_itemsData);

  var html = '<div class="fade-in space-y-4">';
  html += '<div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">';
  html += '<div class="flex gap-2 flex-wrap">';
  html += '<div class="relative"><i class="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>';
  html += '<input type="text" id="itemSearch" placeholder="ค้นหาวัสดุ..." value="' + escHtml(_itemsFilter.search) + '"';
  html += ' onkeyup="debounceItemFilter()" class="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 w-48"></div>';
  html += '<select id="itemCatFilter" onchange="applyItemFilter()" class="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500">';
  html += '<option value="all">ทุกหมวดหมู่</option>';
  cats.forEach(function(c){ html += '<option value="' + escHtml(c) + '" ' + (_itemsFilter.category===c?'selected':'') + '>' + escHtml(c) + '</option>'; });
  html += '</select>';
  html += '<select id="itemStockFilter" onchange="applyItemFilter()" class="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500">';
  html += '<option value="all">สต็อกทั้งหมด</option><option value="low" ' + (_itemsFilter.stock==='low'?'selected':'') + '>ใกล้หมด</option><option value="ok" ' + (_itemsFilter.stock==='ok'?'selected':'') + '>ปกติ</option>';
  html += '</select></div>';
  html += '<div class="flex gap-2">';
  html += '<button onclick="downloadCSVSample()" class="btn-secondary flex items-center gap-2 whitespace-nowrap btn-sm"><i class="fi fi-rr-download"></i> ไฟล์ตัวอย่าง</button>';
  html += '<button onclick="openImportCSVModal()" class="btn-success flex items-center gap-2 whitespace-nowrap btn-sm"><i class="fi fi-rr-upload"></i> นำเข้า CSV</button>';
  html += '<button onclick="openAddItemModal()" class="btn-primary flex items-center gap-2 whitespace-nowrap"><i class="fi fi-rr-plus"></i> เพิ่มวัสดุใหม่</button></div></div>';

  html += '<div class="flex gap-2 flex-wrap text-xs">';
  html += '<span class="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium"><i class="fi fi-rr-box-open-full mr-1"></i>ทั้งหมด: ' + _itemsData.length + '</span>';
  var lowCount = _itemsData.filter(function(i){ return i.current_stock <= i.min_stock; }).length;
  if (lowCount > 0) html += '<span class="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full font-medium"><i class="fi fi-rr-triangle-warning mr-1"></i>ใกล้หมด: ' + lowCount + '</span>';
  html += '</div>';

  html += '<div class="card overflow-hidden">';
  html += '<div class="hidden md:block overflow-x-auto">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-gray-600 text-xs">';
  html += '<tr><th class="px-4 py-3 text-left w-10">#</th><th class="px-4 py-3 text-left w-14">รูป</th><th class="px-4 py-3 text-left">รหัส</th><th class="px-4 py-3 text-left">ชื่อวัสดุ</th><th class="px-4 py-3 text-left">ขนาด</th><th class="px-4 py-3 text-left">หน่วย</th><th class="px-4 py-3 text-left">หมวดหมู่</th><th class="px-4 py-3 text-center">สต็อก</th><th class="px-4 py-3 text-center">ขั้นต่ำ</th><th class="px-4 py-3 text-center">สถานะ</th><th class="px-4 py-3 text-center">จัดการ</th></tr></thead>';
  html += '<tbody class="divide-y divide-gray-100">';
  if (paged.length === 0) {
    html += '<tr><td colspan="11" class="text-center py-10 text-gray-400">ไม่พบรายการ</td></tr>';
  }
  paged.forEach(function(item, idx) {
    var sClass = getStockClass(item.current_stock, item.min_stock);
    var sLabel = getStockLabel(item.current_stock, item.min_stock);
    var imgUrlSrc = imgUrl(item.image_file_id);
    var imgHtml = imgUrlSrc ? '<img src="' + imgUrlSrc + '" class="w-10 h-10 object-cover rounded-lg border border-gray-200" loading="lazy">' : '<div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><i class="fi fi-rr-box-open-full text-sm"></i></div>';
    html += '<tr>';
    html += '<td class="px-4 py-3 text-gray-400 text-xs">' + ((_itemsPage-1)*ITEMS_PER_PAGE + idx + 1) + '</td>';
    html += '<td class="px-4 py-3">' + imgHtml + '</td>';
    html += '<td class="px-4 py-3 font-mono text-xs text-navy-700">' + escHtml(item.item_code) + '</td>';
    html += '<td class="px-4 py-3 font-medium text-gray-800">' + escHtml(item.name) + '</td>';
    html += '<td class="px-4 py-3 text-gray-500 text-xs">' + escHtml(item.size||'-') + '</td>';
    html += '<td class="px-4 py-3 text-gray-600 text-xs">' + escHtml(item.unit) + '</td>';
    html += '<td class="px-4 py-3 text-xs text-gray-500">' + escHtml(item.category||'-') + '</td>';
    html += '<td class="px-4 py-3 text-center font-bold text-gray-800">' + item.current_stock + '</td>';
    html += '<td class="px-4 py-3 text-center text-gray-500 text-xs">' + item.min_stock + '</td>';
    html += '<td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-full text-xs font-medium ' + sClass + '">' + sLabel + '</span></td>';
    html += '<td class="px-4 py-3 text-center"><div class="flex items-center justify-center gap-1">';
    html += '<button title="ดูรายละเอียด" onclick="showItemDetailModal(\'' + item.id + '\')" class="w-7 h-7 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center hover:bg-gray-200"><i class="fi fi-rr-eye text-xs"></i></button>';
    html += '<button title="QR Code" onclick="showQRModal(\'' + item.id + '\')" class="w-7 h-7 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center hover:bg-teal-200"><i class="fi fi-rr-qr-scan text-xs"></i></button>';
    html += '<button title="แก้ไข" onclick="openEditItemModal(\'' + item.id + '\')" class="w-7 h-7 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center hover:bg-blue-200"><i class="fi fi-rr-edit text-xs"></i></button>';
    html += '<button title="ลบ" onclick="deleteItemConfirm(\'' + item.id + '\',\'' + escHtml(item.name) + '\')" class="w-7 h-7 bg-red-100 text-red-700 rounded-lg flex items-center justify-center hover:bg-red-200"><i class="fi fi-rr-trash text-xs"></i></button>';
    html += '</div></td></tr>';
  });
  html += '</tbody></table></div>';

  html += '<div class="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">';
  if (paged.length === 0) html += '<p class="col-span-full text-center text-sm text-gray-400 py-8">ไม่พบรายการ</p>';
  paged.forEach(function(item) {
    var sClass = getStockClass(item.current_stock, item.min_stock);
    var sLabel = getStockLabel(item.current_stock, item.min_stock);
    var imgUrlSrc = imgUrl(item.image_file_id);
    var imgHtml = imgUrlSrc ? '<img src="' + imgUrlSrc + '" class="w-14 h-14 object-cover rounded-xl border border-gray-200" loading="lazy">' : '<div class="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center"><i class="fi fi-rr-box-open-full text-gray-400 text-xl"></i></div>';
    html += '<div class="card p-4 flex flex-col gap-3">';
    html += '<div class="flex items-start justify-between">';
    html += '<div>' + imgHtml + '</div>';
    html += '<span class="px-2 py-0.5 rounded-full text-xs font-medium ' + sClass + '">' + sLabel + '</span></div>';
    html += '<div><p class="font-semibold text-gray-800 text-sm leading-snug">' + escHtml(item.name) + '</p>';
    html += '<p class="text-xs text-gray-400 mt-0.5">' + escHtml(item.item_code) + ' • ' + escHtml(item.size||'') + '</p>';
    html += '<p class="text-xs text-gray-500 mt-0.5">' + escHtml(item.category||'') + '</p></div>';
    html += '<div class="flex justify-between text-xs text-gray-500"><span>คงเหลือ</span><span class="font-bold text-gray-800">' + item.current_stock + ' ' + escHtml(item.unit) + '</span></div>';
    html += '<div class="flex gap-2 pt-1">';
    html += '<button onclick="showItemDetailModal(\'' + item.id + '\')" class="flex-1 btn-secondary btn-sm text-xs"><i class="fi fi-rr-eye mr-1"></i>ดู</button>';
    html += '<button onclick="showQRModal(\'' + item.id + '\')" class="flex-1 btn-success btn-sm text-xs" style="background:#e0f2f1;color:#00695c;border-color:#b2dfdb"><i class="fi fi-rr-qr-scan mr-1"></i>QR</button>';
    html += '<button onclick="openEditItemModal(\'' + item.id + '\')" class="flex-1 btn-primary btn-sm text-xs"><i class="fi fi-rr-edit mr-1"></i>แก้ไข</button>';
    html += '</div></div>';
  });
  html += '</div></div>';

  html += '<div id="itemsPagination"></div>';
  html += '</div>';
  document.getElementById('mainContent').innerHTML = html;
  renderPagination('itemsPagination', filtered.length, _itemsPage, function(p) { _itemsPage = p; buildItemsPage(); });
}

function filterItems(data, f) {
  return data.filter(function(i) {
    if (f.search && !i.name.toLowerCase().includes(f.search.toLowerCase()) && !(i.item_code||'').toLowerCase().includes(f.search.toLowerCase())) return false;
    if (f.category !== 'all' && i.category !== f.category) return false;
    if (f.stock === 'low' && i.current_stock > i.min_stock) return false;
    if (f.stock === 'ok'  && i.current_stock <= i.min_stock) return false;
    return true;
  });
}
function getCategoryList(data) {
  var cats = {};
  data.forEach(function(i){ if(i.category) cats[i.category]=1; });
  return Object.keys(cats).sort();
}
function paginate(data, page) {
  return data.slice((page-1)*ITEMS_PER_PAGE, page*ITEMS_PER_PAGE);
}

var _filterTimer;
function debounceItemFilter() { clearTimeout(_filterTimer); _filterTimer = setTimeout(applyItemFilter, 400); }
function applyItemFilter() {
  _itemsFilter.search   = (document.getElementById('itemSearch') || {}).value || '';
  _itemsFilter.category = (document.getElementById('itemCatFilter') || {}).value || 'all';
  _itemsFilter.stock    = (document.getElementById('itemStockFilter') || {}).value || 'all';
  _itemsPage = 1;
  buildItemsPage();
}

function downloadCSVSample() {
  var csv = 'รหัส,ชื่อวัสดุ,ขนาด,หน่วย,หมวดหมู่,สต็อกเริ่มต้น,สต็อกขั้นต่ำ,รายละเอียด\n';
  csv += 'ITEM-001,วัสดุตัวอย่างที่ 1,-,ชิ้น,วัสดุทั่วไป,100,10,รายละเอียดวัสดุตัวอย่างที่ 1\n';
  csv += 'ITEM-002,วัสดุตัวอย่างที่ 2,-,ชิ้น,วัสดุทั่วไป,50,5,รายละเอียดวัสดุตัวอย่างที่ 2\n';
  csv += 'ITEM-003,วัสดุตัวอย่างที่ 3,-,ชิ้น,วัสดุทั่วไป,30,5,รายละเอียดวัสดุตัวอย่างที่ 3\n';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'ตัวอย่าง_รายการวัสดุ.csv';
  link.click();
}

var _csvImportRows = [];
function openImportCSVModal() {
  _csvImportRows = [];
  var body = '<div class="space-y-4">';
  body += '<p class="text-sm text-gray-600">อัปโหลดไฟล์ CSV ตามรูปแบบตัวอย่าง ระบบจะแสดงตัวอย่างข้อมูลก่อนนำเข้า</p>';
  body += '<input type="file" id="csvImportFile" accept=".csv" onchange="previewCSVImport()" class="form-input py-1.5">';
  body += '<div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">';
  body += '<p class="font-semibold mb-1">หมายเหตุ</p>';
  body += '<ul class="list-disc list-inside space-y-0.5">';
  body += '<li>รองรับไฟล์ .csv เท่านั้น (UTF-8)</li>';
  body += '<li>คอลัมน์: รหัส,ชื่อวัสดุ,ขนาด,หน่วย,หมวดหมู่,สต็อกเริ่มต้น,สต็อกขั้นต่ำ,รายละเอียด</li>';
  body += '<li>หากไม่มีรหัส ระบบจะสร้างรหัสอัตโนมัติ</li>';
  body += '</ul></div>';
  body += '<div id="csvImportPreview"></div>';
  body += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>'
    + '<button onclick="handleCSVImport()" class="btn-success"><i class="fi fi-rr-upload mr-1"></i>นำเข้า</button>';
  openModal('นำเข้ารายการวัสดุจาก CSV', body, footer);
}

function previewCSVImport() {
  var input = document.getElementById('csvImportFile');
  var previewDiv = document.getElementById('csvImportPreview');
  if (!input || !input.files[0]) { previewDiv.innerHTML = ''; return; }
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    _csvImportRows = parseCSV(e.target.result);
    if (_csvImportRows.length === 0) { previewDiv.innerHTML = '<p class="text-sm text-red-500">ไม่พบข้อมูลในไฟล์</p>'; return; }
    var html = '<p class="text-sm font-medium text-gray-700 mb-2">ตัวอย่างข้อมูล (' + _csvImportRows.length + ' รายการ)</p>';
    html += '<div class="max-h-64 overflow-y-auto border border-gray-200 rounded-xl">';
    html += '<table class="w-full text-xs"><thead class="bg-gray-50 text-gray-600 sticky top-0">';
    html += '<tr><th class="px-2 py-1.5 text-left">รหัส</th><th class="px-2 py-1.5 text-left">ชื่อ</th><th class="px-2 py-1.5 text-left">หน่วย</th><th class="px-2 py-1.5 text-center">สต็อก</th><th class="px-2 py-1.5 text-center">ขั้นต่ำ</th></tr></thead><tbody class="divide-y divide-gray-100">';
    _csvImportRows.forEach(function(row) {
      html += '<tr><td class="px-2 py-1.5">' + escHtml(row['รหัส'] || '-') + '</td>';
      html += '<td class="px-2 py-1.5">' + escHtml(row['ชื่อวัสดุ'] || '') + '</td>';
      html += '<td class="px-2 py-1.5">' + escHtml(row['หน่วย'] || '') + '</td>';
      html += '<td class="px-2 py-1.5 text-center">' + escHtml(row['สต็อกเริ่มต้น'] || '0') + '</td>';
      html += '<td class="px-2 py-1.5 text-center">' + escHtml(row['สต็อกขั้นต่ำ'] || '5') + '</td></tr>';
    });
    html += '</tbody></table></div>';
    previewDiv.innerHTML = html;
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCSV(text) {
  var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(function(l){ return l.trim() !== ''; });
  if (lines.length < 2) return [];
  var headers = lines[0].split(',').map(function(h){ return h.trim(); });
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = lines[i].split(',');
    if (cols.length < 2) continue;
    var row = {};
    headers.forEach(function(h, idx){ row[h] = (cols[idx] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function handleCSVImport() {
  var rows = _csvImportRows;
  if (!rows || rows.length === 0) { showError('กรุณาเลือกไฟล์ CSV ก่อน'); return; }
  showConfirm('ยืนยันนำเข้า', 'พบ ' + rows.length + ' รายการ ยืนยันนำเข้า?', function() {
    showLoading('กำลังนำเข้า ' + rows.length + ' รายการ...');
    var promises = rows.map(function(row) {
      var itemCode = row['รหัส'] || '';
      var name = row['ชื่อวัสดุ'] || '';
      if (!name) return Promise.resolve({ success: false, message: 'ขาดชื่อวัสดุ' });
      var data = {
        item_code: itemCode,
        name: name,
        size: row['ขนาด'] || '',
        unit: row['หน่วย'] || 'ชิ้น',
        category: row['หมวดหมู่'] || '',
        current_stock: parseInt(row['สต็อกเริ่มต้น'] || 0),
        min_stock: parseInt(row['สต็อกขั้นต่ำ'] || 5),
        description: row['รายละเอียด'] || ''
      };
      return callAPI('addItem', AUTH.token, data);
    });
    Promise.all(promises).then(function(results) {
      hideLoading(); closeModal();
      var ok = results.filter(function(r){ return r && r.success; }).length;
      var fail = results.length - ok;
      if (fail > 0) showError('นำเข้าสำเร็จ ' + ok + ' รายการ ล้มเหลว ' + fail + ' รายการ');
      else showSuccess('นำเข้าสำเร็จ ' + ok + ' รายการ');
      _itemsCacheTime = 0;
      renderItems();
    }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
  });
}

function openAddItemModal() {
  _itemImageFileId = null;
  var body = itemFormHTML({});
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>'
    + '<button onclick="submitAddItem()" class="btn-primary"><i class="fi fi-rr-plus mr-1"></i>เพิ่มวัสดุ</button>';
  openModal('เพิ่มรายการวัสดุใหม่', body, footer);
}
function openEditItemModal(id) {
  var item = _itemsData.find(function(i){ return i.id === id; });
  if (!item) return;
  _itemImageFileId = item.image_file_id || null;
  var body = itemFormHTML(item);
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>'
    + '<button onclick="submitEditItem(\'' + id + '\')" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึก</button>';
  openModal('แก้ไขรายการวัสดุ', body, footer);
}
function itemFormHTML(item) {
  var fid = _itemImageFileId || item.image_file_id || '';
  var imgSection = '';
  if (fid) {
    var imgSrc = imgUrl(fid);
    imgSection = '<div class="sm:col-span-2"><label class="form-label">รูปภาพวัสดุ</label><div class="flex items-center gap-3"><img id="itemImgPreview" src="' + (imgSrc||'') + '" class="w-24 h-24 object-cover rounded-xl border border-gray-200"><button onclick="removeItemImage()" type="button" class="text-red-500 text-sm hover:underline">ลบรูป</button></div><input type="hidden" id="itemImageFileId" value="' + fid + '"></div>';
  } else {
    imgSection = '<div class="sm:col-span-2"><label class="form-label">รูปภาพวัสดุ</label><input type="file" id="itemImageFile" accept="image/*" onchange="handleItemImageUpload(this)" class="form-input py-1.5"><p class="text-xs text-gray-400 mt-1">รองรับ JPG, PNG (สูงสุด 5MB)</p><div id="itemImagePreview"></div></div>';
  }
  return '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">'
    + fieldHTML('ชื่อวัสดุ *', 'itemName', 'text', item.name||'', 'sm:col-span-2')
    + fieldHTML('ขนาดบรรจุ', 'itemSize', 'text', item.size||'')
    + fieldHTML('หน่วย *', 'itemUnit', 'text', item.unit||'')
    + fieldHTML('หมวดหมู่', 'itemCategory', 'text', item.category||'วัสดุทำความสะอาด')
    + fieldHTML('สต็อกเริ่มต้น', 'itemStock', 'number', item.current_stock||0)
    + fieldHTML('สต็อกขั้นต่ำ', 'itemMinStock', 'number', item.min_stock||5)
    + imgSection
    + '</div>';
}
function fieldHTML(label, id, type, value, extra) {
  return '<div class="' + (extra||'') + '">'
    + '<label class="form-label">' + escHtml(label) + '</label>'
    + '<input type="' + type + '" id="' + id + '" value="' + escHtml(String(value)) + '" class="form-input"></div>';
}

function submitAddItem() {
  var data = readItemForm();
  if (!data) return;
  showLoading('กำลังบันทึก...');
  callAPI('addItem', AUTH.token, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderItems(); }
    else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function submitEditItem(id) {
  var data = readItemForm();
  if (!data) return;
  showLoading('กำลังบันทึก...');
  callAPI('updateItem', AUTH.token, id, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderItems(); }
    else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function readItemForm() {
  var name = (document.getElementById('itemName')||{}).value||'';
  var unit = (document.getElementById('itemUnit')||{}).value||'';
  if (!name.trim()) { showError('กรุณากรอกชื่อวัสดุ'); return null; }
  if (!unit.trim()) { showError('กรุณากรอกหน่วย'); return null; }
  return {
    name: name, size: (document.getElementById('itemSize')||{}).value||'',
    unit: unit, category: (document.getElementById('itemCategory')||{}).value||'',
    current_stock: parseInt((document.getElementById('itemStock')||{}).value)||0,
    min_stock: parseInt((document.getElementById('itemMinStock')||{}).value)||5,
    image_file_id: (document.getElementById('itemImageFileId')||{}).value||_itemImageFileId||''
  };
}
function handleItemImageUpload(input) {
  var file = input.files[0];
  if (!file) return;
  if (!file.type.match('image.*')) { showError('กรุณาเลือกไฟล์รูปภาพ'); input.value=''; return; }
  if (file.size > 5 * 1024 * 1024) { showError('ไฟล์ใหญ่เกิน 5MB'); input.value=''; return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result.split(',')[1];
    showLoading('กำลังอัปโหลดรูป...');
    callAPI('uploadFile', AUTH.token, base64, file.type, file.name).then(function(res) {
      hideLoading();
      if (res.success) {
        _itemImageFileId = res.file_id;
        var preview = document.getElementById('itemImagePreview');
        var imgSrc = imgUrl(res.file_id);
        if (preview) preview.innerHTML = '<img src="' + (imgSrc||'') + '" class="w-24 h-24 object-cover rounded-xl border border-gray-200 mt-2">';
        showSuccess('อัปโหลดรูปเรียบร้อย');
      } else {
        showError(res.message || 'อัปโหลดไม่สำเร็จ');
      }
    }).catch(function() { hideLoading(); showError('อัปโหลดไม่สำเร็จ'); });
  };
  reader.readAsDataURL(file);
}
function removeItemImage() {
  _itemImageFileId = null;
  var name = (document.getElementById('itemName')||{}).value||'';
  var size = (document.getElementById('itemSize')||{}).value||'';
  var unit = (document.getElementById('itemUnit')||{}).value||'';
  var cat  = (document.getElementById('itemCategory')||{}).value||'';
  var stock = (document.getElementById('itemStock')||{}).value||0;
  var min   = (document.getElementById('itemMinStock')||{}).value||5;
  var fakeItem = {name:name, size:size, unit:unit, category:cat, current_stock:stock, min_stock:min, image_file_id:''};
  var body = itemFormHTML(fakeItem);
  document.getElementById('modalBody').innerHTML = body;
}

function deleteItemConfirm(id, name) {
  showConfirm('ลบรายการวัสดุ', 'ต้องการลบ "' + name + '" ใช่หรือไม่?', function() {
    showLoading('กำลังลบ...');
    callAPI('deleteItem', AUTH.token, id).then(function(res) {
      hideLoading();
      if (res.success) { showSuccess(res.message); renderItems(); }
      else showError(res.message);
    }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
  }, 'ลบ');
}

function showItemDetailModal(itemId) {
  var item = _itemsData.find(function(i){ return i.id === itemId; });
  if (!item) return;
  var sClass = getStockClass(item.current_stock, item.min_stock);
  var sLabel = getStockLabel(item.current_stock, item.min_stock);
  var pct = item.min_stock > 0 ? Math.min(100, Math.round(item.current_stock / (item.min_stock * 3) * 100)) : 50;
  var barColor = item.current_stock <= 0 ? 'bg-red-500' : item.current_stock <= item.min_stock ? 'bg-amber-400' : 'bg-green-500';

  var imgUrlSrc = imgUrl(item.image_file_id);
  var imgSection = '';
  if (imgUrlSrc) {
    imgSection = '<div class="flex justify-center mb-4"><img src="' + imgUrlSrc + '" class="w-40 h-40 object-cover rounded-2xl border border-gray-200 shadow-sm" loading="lazy"></div>';
  } else {
    imgSection = '<div class="flex justify-center mb-4"><div class="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center"><i class="fi fi-rr-box-open-full text-gray-300 text-4xl"></i></div></div>';
  }

  var body = '<div class="text-center mb-5">'
    + imgSection
    + '<p class="font-mono text-xs text-navy-600 mb-1">' + escHtml(item.item_code) + '</p>'
    + '<h2 class="text-lg font-bold text-gray-800">' + escHtml(item.name) + '</h2>'
    + (item.size ? '<p class="text-sm text-gray-500 mt-1">' + escHtml(item.size) + '</p>' : '')
    + '</div>';

  body += '<div class="space-y-3">';
  body += '<div class="grid grid-cols-2 gap-3">'
    + '<div class="bg-gray-50 rounded-xl p-3 text-center"><p class="text-xs text-gray-400 mb-1">หมวดหมู่</p><p class="text-sm font-semibold text-gray-700">' + escHtml(item.category || '-') + '</p></div>'
    + '<div class="bg-gray-50 rounded-xl p-3 text-center"><p class="text-xs text-gray-400 mb-1">หน่วย</p><p class="text-sm font-semibold text-gray-700">' + escHtml(item.unit) + '</p></div>'
    + '</div>';

  body += '<div class="bg-white border border-gray-200 rounded-xl p-4">'
    + '<div class="flex items-center justify-between mb-2">'
    + '<span class="text-sm text-gray-500">คงเหลือในระบบ</span>'
    + '<span class="text-xl font-bold text-gray-800">' + item.current_stock + ' <span class="text-sm font-normal text-gray-500">' + item.unit + '</span></span>'
    + '</div>'
    + '<div class="progress-bar mb-2"><div class="progress-fill ' + barColor + '" style="width:' + pct + '%"></div></div>'
    + '<div class="flex items-center justify-between">'
    + '<span class="text-xs text-gray-400">ขั้นต่ำ: ' + item.min_stock + ' ' + item.unit + '</span>'
    + '<span class="px-2 py-0.5 rounded-full text-xs font-medium ' + sClass + '">' + sLabel + '</span>'
    + '</div></div>';

  if (item.description) {
    body += '<div class="bg-gray-50 rounded-xl p-3"><p class="text-xs text-gray-400 mb-1">หมายเหตุ / รายละเอียด</p><p class="text-sm text-gray-700">' + escHtml(item.description) + '</p></div>';
  }

  if (item.created_at || item.updated_at) {
    body += '<div class="text-xs text-gray-400 text-center pt-1">'
      + (item.created_at ? '<span>เพิ่มเมื่อ: ' + formatDate(item.created_at) + '</span>' : '')
      + (item.updated_at ? ' <span class="mx-1">|</span> <span>อัปเดตล่าสุด: ' + formatDate(item.updated_at) + '</span>' : '')
      + '</div>';
  }

  body += '</div>';

  var footer = '<button onclick="closeModal()" class="btn-secondary">ปิด</button>'
    + '<button onclick="openWithdrawModal(\'' + item.id + '\')" class="btn-primary"><i class="fi fi-rr-inbox-out mr-1"></i>เบิกวัสดุ</button>';
  openModal('รายละเอียดวัสดุ', body, footer);
}

// ===== QR CODE =====
function showQRModal(itemId) {
  var item = _itemsData.find(function(i){ return i.id === itemId; });
  if (!item) return;
  var baseUrl = window.location.origin + window.location.pathname;
  var qrUrl  = baseUrl + '?action=withdraw&item_id=' + itemId;
  var body = '<div class="text-center">'
    + '<p class="font-semibold text-gray-700 mb-1">' + escHtml(item.name) + '</p>'
    + '<p class="text-xs text-gray-500 mb-4">' + escHtml(item.item_code) + ' • ' + escHtml(item.size||'') + ' • ' + item.unit + '</p>'
    + '<div id="qrCanvas" class="flex justify-center mb-4"></div>'
    + '<p class="text-xs text-gray-400 break-all border rounded-lg px-3 py-2 bg-gray-50">' + escHtml(qrUrl) + '</p>'
    + '<p class="text-xs text-gray-400 mt-3">พนักงานสแกน QR นี้ด้วยกล้องมือถือเพื่อเบิกวัสดุ</p></div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ปิด</button>'
    + '<button onclick="printQRLabel(\'' + escHtml(JSON.stringify(item).replace(/'/g,'&#39;')) + '\')" class="btn-primary"><i class="fi fi-rr-print mr-1"></i>พิมพ์</button>';
  openModal('QR Code — ' + item.name, body, footer);
  setTimeout(function() {
    new QRCode(document.getElementById('qrCanvas'), {
      text: qrUrl, width:180, height:180,
      colorDark:'#1a2566', colorLight:'#ffffff', correctLevel:QRCode.CorrectLevel.M
    });
  }, 100);
}

function printQRLabel(itemJson) {
  var item = JSON.parse(itemJson);
  var baseUrl = window.location.origin + window.location.pathname;
  var qrUrl  = baseUrl + '?action=withdraw&item_id=' + item.id;
  var win = window.open('', '_blank');
  var css = 'body{font-family:sarabun,sans-serif;margin:0;padding:0;background:#fff}' +
    '.label{width:58mm;height:40mm;border:1.5px dashed #ccc;padding:3mm;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;margin:4mm auto}' +
    '.name{font-size:11px;font-weight:700;color:#1a2566;margin:0 0 1mm;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.meta{font-size:8px;color:#666;margin:0 0 1mm}' +
    '.qr-wrap{width:22mm;height:22mm;margin:0 auto}' +
    '@media print{.label{border-style:solid!important;border-color:#333!important;page-break-inside:avoid;margin:2mm}}';
  win.document.write('<html><head><title>ป้าย ' + item.name + '</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">'
    + '<style>' + css + '</style></head><body>'
    + '<div class="label">'
    + '<p class="name">' + escHtml(item.name) + '</p>'
    + '<p class="meta">' + escHtml(item.item_code) + (item.size ? ' • ' + escHtml(item.size) : '') + '</p>'
    + '<div class="qr-wrap" id="qr"></div>'
    + '</div>'
    + '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>'
    + '<script>new QRCode(document.getElementById("qr"),{text:"' + qrUrl + '",width:80,height:80,colorDark:"#1a2566",correctLevel:QRCode.CorrectLevel.M});'
    + 'setTimeout(function(){window.print();window.close();},700);<\/script>'
    + '</body></html>');
  win.document.close();
}

// ===== STOCK =====
var _stockData = [];
var _stockView = 'card';

function updateLowStockBadge(items) {
  var lowBadge = document.getElementById('lowStockBadge');
  if (!lowBadge) return;
  var count = (items || []).filter(function(i){ return i.active !== false && i.current_stock <= i.min_stock; }).length;
  if (count > 0) { lowBadge.textContent = count; lowBadge.classList.remove('hidden'); }
  else { lowBadge.classList.add('hidden'); }
}

function renderStock() {
  showLoading('โหลดสต็อก...');
  // reuse cache ถ้ายังไม่หมดอายุ
  if (_itemsData.length > 0 && (Date.now() - _itemsCacheTime) < ITEMS_CACHE_TTL) {
    hideLoading();
    _stockData = _itemsData;
    updateLowStockBadge(_itemsData);
    buildStockPage();
    return;
  }
  callAPI('getItems', AUTH.token).then(function(res) {
    hideLoading();
    if (!res.success) { showError(res.message); return; }
    _itemsData = res.data;
    _itemsCacheTime = Date.now();
    _stockData = res.data;
    updateLowStockBadge(_itemsData);
    buildStockPage();
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildStockPage() {
  var html = '<div class="fade-in space-y-4">';
  html += '<div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">';
  html += '<div class="flex gap-2 flex-wrap">';
  html += '<div class="relative"><i class="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>'
    + '<input type="text" id="stockSearch" placeholder="ค้นหา..." onkeyup="filterStock()" class="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 w-44"></div>';
  html += '<select id="stockCatFilter" onchange="filterStock()" class="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">';
  html += '<option value="">ทุกหมวด</option>';
  getCategoryList(_stockData).forEach(function(c){ html += '<option>' + escHtml(c) + '</option>'; });
  html += '</select></div>';
  html += '<div class="flex gap-2">';
  html += '<button onclick="setStockView(\'card\')" id="btnCardView" class="px-3 py-2 border rounded-xl text-sm ' + (_stockView==='card'?'bg-navy-700 text-white border-navy-700':'border-gray-300 text-gray-600 hover:bg-gray-50') + '"><i class="fi fi-rr-grid"></i></button>';
  html += '<button onclick="setStockView(\'table\')" id="btnTableView" class="px-3 py-2 border rounded-xl text-sm ' + (_stockView==='table'?'bg-navy-700 text-white border-navy-700':'border-gray-300 text-gray-600 hover:bg-gray-50') + '"><i class="fi fi-rr-list"></i></button>';
  html += '</div></div>';

  html += '<div id="stockContent">' + buildStockContent(_stockData) + '</div>';
  html += '</div>';
  document.getElementById('mainContent').innerHTML = html;
}

function buildStockContent(data) {
  if (_stockView === 'card') {
    var html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">';
    if (data.length === 0) html += '<p class="col-span-4 text-center text-gray-400 py-10">ไม่พบรายการ</p>';
    data.forEach(function(item) {
      var sClass = getStockClass(item.current_stock, item.min_stock);
      var sLabel = getStockLabel(item.current_stock, item.min_stock);
      var pct = item.min_stock > 0 ? Math.min(100, Math.round(item.current_stock / (item.min_stock*3) * 100)) : 50;
      var barColor = item.current_stock <= 0 ? 'bg-red-500' : item.current_stock <= item.min_stock ? 'bg-amber-400' : 'bg-green-500';
      html += '<div class="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">';
      html += '<div class="flex items-start justify-between">';
      var imgUrlSrc = imgUrl(item.image_file_id);
      var cardImg = imgUrlSrc ? '<img src="' + imgUrlSrc + '" class="w-10 h-10 object-cover rounded-xl border border-gray-200" loading="lazy">' : '<div class="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center"><i class="fi fi-rr-box-open-full text-navy-700 text-lg"></i></div>';
      html += '<div>' + cardImg + '</div>';
      html += '<span class="px-2 py-0.5 rounded-full text-xs font-medium ' + sClass + '">' + sLabel + '</span></div>';
      html += '<div><p class="font-semibold text-gray-800 text-sm leading-snug">' + escHtml(item.name) + '</p>';
      html += '<p class="text-xs text-gray-400 mt-0.5">' + escHtml(item.size||'') + ' • ' + escHtml(item.category||'') + '</p></div>';
      html += '<div><div class="flex justify-between text-xs text-gray-500 mb-1"><span>คงเหลือ</span><span class="font-bold text-gray-800">' + item.current_stock + ' ' + item.unit + '</span></div>';
      html += '<div class="progress-bar"><div class="progress-fill ' + barColor + '" style="width:' + pct + '%"></div></div>';
      html += '<p class="text-xs text-gray-400 mt-1">ขั้นต่ำ: ' + item.min_stock + ' ' + item.unit + '</p></div>';
      html += '<div class="flex gap-2 pt-1">';
      html += '<button onclick="showItemDetailModal(\'' + item.id + '\')" class="flex-1 btn-secondary btn-sm text-xs" title="ดูรายละเอียด"><i class="fi fi-rr-eye mr-1"></i>ดู</button>';
      if (AUTH.user.role !== 'employee') {
        html += '<button onclick="openReceiveModal(\'' + item.id + '\')" class="flex-1 btn-success btn-sm text-xs"><i class="fi fi-rr-inbox-in mr-1"></i>รับเข้า</button>';
      }
      html += '<button onclick="openWithdrawModal(\'' + item.id + '\')" class="flex-1 btn-primary btn-sm text-xs"><i class="fi fi-rr-inbox-out mr-1"></i>เบิก</button>';
      html += '</div></div>';
    });
    return html + '</div>';
  } else {
    var html = '<div class="card overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
    html += '<tr><th class="px-4 py-3 text-left">รหัส</th><th class="px-4 py-3 text-left">ชื่อวัสดุ</th><th class="px-4 py-3 text-left">หน่วย</th>';
    html += '<th class="px-4 py-3 text-center">สต็อก</th><th class="px-4 py-3 text-center">ขั้นต่ำ</th><th class="px-4 py-3 text-center">สถานะ</th><th class="px-4 py-3 text-center">การดำเนินการ</th></tr>';
    html += '</thead><tbody class="divide-y divide-gray-100">';
    if (data.length === 0) html += '<tr><td colspan="7" class="text-center py-8 text-gray-400">ไม่พบรายการ</td></tr>';
    data.forEach(function(item) {
      var sClass = getStockClass(item.current_stock, item.min_stock);
      html += '<tr><td class="px-4 py-2.5 font-mono text-xs text-navy-700">' + escHtml(item.item_code) + '</td>';
      html += '<td class="px-4 py-2.5 font-medium text-gray-700">' + escHtml(item.name) + '</td>';
      html += '<td class="px-4 py-2.5 text-xs text-gray-500">' + escHtml(item.unit) + '</td>';
      html += '<td class="px-4 py-2.5 text-center font-bold">' + item.current_stock + '</td>';
      html += '<td class="px-4 py-2.5 text-center text-gray-400">' + item.min_stock + '</td>';
      html += '<td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs ' + sClass + '">' + getStockLabel(item.current_stock, item.min_stock) + '</span></td>';
      html += '<td class="px-4 py-2.5 text-center"><div class="flex gap-1 justify-center">';
      html += '<button onclick="showItemDetailModal(\'' + item.id + '\')" class="btn-secondary btn-sm text-xs" title="ดูรายละเอียด"><i class="fi fi-rr-eye"></i></button>';
      if (AUTH.user.role !== 'employee') html += '<button onclick="openReceiveModal(\'' + item.id + '\')" class="btn-success btn-sm text-xs"><i class="fi fi-rr-inbox-in mr-1"></i>รับเข้า</button>';
      html += '<button onclick="openWithdrawModal(\'' + item.id + '\')" class="btn-primary btn-sm text-xs"><i class="fi fi-rr-inbox-out mr-1"></i>เบิก</button>';
      html += '</div></td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }
}

function setStockView(view) {
  _stockView = view;
  buildStockPage();
}
function filterStock() {
  var q   = (document.getElementById('stockSearch')||{}).value||'';
  var cat = (document.getElementById('stockCatFilter')||{}).value||'';
  var filtered = _stockData.filter(function(i) {
    if (q && !i.name.toLowerCase().includes(q.toLowerCase()) && !(i.item_code||'').toLowerCase().includes(q.toLowerCase())) return false;
    if (cat && i.category !== cat) return false;
    return true;
  });
  document.getElementById('stockContent').innerHTML = buildStockContent(filtered);
}

// ===== RECEIVE =====
var _receiveData = [];
var _receivePage = 1;

function renderReceive() {
  showLoading('โหลดข้อมูลรับเข้า...');
  var itemsPromise = (_itemsData.length > 0 && (Date.now() - _itemsCacheTime) < ITEMS_CACHE_TTL)
    ? Promise.resolve({ success: true, data: _itemsData })
    : callAPI('getItems', AUTH.token).then(function(res){ _itemsData = res.data||[]; _itemsCacheTime = Date.now(); return res; });
  Promise.all([ itemsPromise, callAPI('getReceives', AUTH.token, {}) ]).then(function(results) {
    hideLoading();
    _itemsData   = results[0].data || [];
    _receiveData = results[1].data || [];
    _receivePage = 1;
    buildReceivePage();
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildReceivePage() {
  var paged = paginate(_receiveData, _receivePage);
  var html = '<div class="fade-in space-y-4">';
  html += '<div class="flex items-center justify-between">';
  html += '<h3 class="font-semibold text-gray-700">ประวัติรับวัสดุเข้าคลัง</h3>';
  html += '<button onclick="openReceiveModal(null)" class="btn-primary flex items-center gap-2"><i class="fi fi-rr-plus"></i> บันทึกรับเข้า</button></div>';

  html += '<div class="card overflow-hidden"><div class="overflow-x-auto">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
  html += '<tr><th class="px-4 py-3 text-left">เลขที่รับ</th><th class="px-4 py-3 text-left">วันที่</th>';
  html += '<th class="px-4 py-3 text-left">รายการ</th><th class="px-4 py-3 text-center">จำนวน</th>';
  html += '<th class="px-4 py-3 text-left">ผู้รับ</th><th class="px-4 py-3 text-left">หมายเหตุ</th></tr></thead>';
  html += '<tbody class="divide-y divide-gray-100">';
  if (paged.length === 0) html += '<tr><td colspan="6" class="text-center py-10 text-gray-400">ยังไม่มีรายการรับเข้า</td></tr>';
  paged.forEach(function(r) {
    html += '<tr><td class="px-4 py-2.5 font-mono text-xs text-navy-700">' + escHtml(r.receive_no) + '</td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-600">' + formatDate(r.date) + '</td>';
    html += '<td class="px-4 py-2.5 font-medium text-gray-700">' + escHtml(r.item_name||'-') + '</td>';
    html += '<td class="px-4 py-2.5 text-center font-bold text-blue-700">+' + r.quantity + ' ' + escHtml(r.unit||'') + '</td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-500">' + escHtml(r.received_by_name||'-') + '</td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-400">' + escHtml(r.note||'-') + '</td></tr>';
  });
  html += '</tbody></table></div></div>';
  html += '<div id="receivePagination"></div></div>';
  document.getElementById('mainContent').innerHTML = html;
  renderPagination('receivePagination', _receiveData.length, _receivePage, function(p){ _receivePage=p; buildReceivePage(); });
}

function openReceiveModal(itemId) {
  var body = '<div class="space-y-4">';
  if (!itemId) {
    body += '<div><label class="form-label">เลือกวัสดุ *</label><select id="recItemId" class="form-input">';
    _itemsData.forEach(function(i){ body += '<option value="' + i.id + '">' + escHtml(i.name) + ' (คงเหลือ ' + i.current_stock + ' ' + i.unit + ')</option>'; });
    body += '</select></div>';
  } else {
    var item = _itemsData.find(function(i){ return i.id === itemId; });
    body += '<input type="hidden" id="recItemId" value="' + itemId + '">';
    body += '<p class="text-sm text-gray-600">รายการ: <b>' + escHtml(item.name) + '</b> (คงเหลือ ' + item.current_stock + ' ' + item.unit + ')</p>';
  }
  body += fieldHTML('จำนวนที่รับ *', 'recQty', 'number', 1);
  body += fieldHTML('วันที่', 'recDate', 'date', new Date().toISOString().split('T')[0]);
  body += '<div class="sm:col-span-2"><label class="form-label">หมายเหตุ</label><textarea id="recNote" class="form-input" rows="2"></textarea></div>';
  body += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>'
    + '<button onclick="submitReceive()" class="btn-success"><i class="fi fi-rr-inbox-in mr-1"></i>บันทึกรับเข้า</button>';
  openModal('รับวัสดุเข้าคลัง', body, footer);
}

function submitReceive() {
  var itemId = (document.getElementById('recItemId')||{}).value||'';
  var qty    = parseInt((document.getElementById('recQty')||{}).value||0);
  var date   = (document.getElementById('recDate')||{}).value||'';
  var note   = (document.getElementById('recNote')||{}).value||'';
  if (!itemId) { showError('กรุณาเลือกวัสดุ'); return; }
  if (!qty || qty <= 0) { showError('จำนวนไม่ถูกต้อง'); return; }
  showLoading('กำลังบันทึก...');
  callAPI('addReceive', AUTH.token, { item_id:itemId, quantity:qty, date:date, note:note }).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderReceive(); }
    else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}

// ===== STOCKTAKE =====
function renderStocktake() {
  showLoading('โหลดข้อมูล...');
  var itemsPromise = (_itemsData.length > 0 && (Date.now() - _itemsCacheTime) < ITEMS_CACHE_TTL)
    ? Promise.resolve({ success: true, data: _itemsData })
    : callAPI('getItems', AUTH.token).then(function(res){ _itemsData = res.data||[]; _itemsCacheTime = Date.now(); return res; });
  itemsPromise.then(function(res) {
    hideLoading();
    _itemsData = res.data || [];
    buildStocktakePage();
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildStocktakePage() {
  var html = '<div class="fade-in space-y-4">';
  html += '<div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">';
  html += '<h3 class="font-semibold text-gray-700"><i class="fi fi-rr-clipboard-list text-navy-600 mr-2"></i>นับสต็อก</h3>';
  html += '<button onclick="submitStocktake()" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึกการปรับยอด</button></div>';
  html += '<p class="text-xs text-gray-500">กรอกจำนวนที่นับได้จริงในช่อง "นับจริง" แล้วกดบันทึก ระบบจะปรับยอดให้อัตโนมัติ</p>';
  html += '<div class="card overflow-hidden"><div class="overflow-x-auto">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-gray-600 text-xs">';
  html += '<tr><th class="px-4 py-3 text-left">รหัส/ชื่อ</th><th class="px-4 py-3 text-center">ระบบ</th><th class="px-4 py-3 text-center">นับจริง</th><th class="px-4 py-3 text-center">ผลต่าง</th></tr></thead>';
  html += '<tbody class="divide-y divide-gray-100">';
  _itemsData.forEach(function(item) {
    html += '<tr data-st-id="' + item.id + '"><td class="px-4 py-3"><p class="font-medium text-gray-800">' + escHtml(item.name) + '</p><p class="text-xs text-gray-500">' + escHtml(item.item_code) + ' • ' + escHtml(item.unit) + '</p></td>';
    html += '<td class="px-4 py-3 text-center font-bold text-gray-800">' + item.current_stock + '</td>';
    html += '<td class="px-4 py-3 text-center"><input type="number" class="st-count w-20 border border-gray-300 rounded-lg px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-navy-500" data-id="' + item.id + '" value="' + item.current_stock + '"></td>';
    html += '<td class="px-4 py-3 text-center"><span class="st-diff text-xs font-medium" data-sys="' + item.current_stock + '">-</span></td></tr>';
  });
  html += '</tbody></table></div></div></div>';
  document.getElementById('mainContent').innerHTML = html;
  // Bind input events to update diff
  document.querySelectorAll('.st-count').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var sys = parseInt(inp.closest('tr').querySelector('.st-diff').getAttribute('data-sys')) || 0;
      var act = parseInt(inp.value) || 0;
      var diff = act - sys;
      var diffEl = inp.closest('tr').querySelector('.st-diff');
      if (diff === 0) { diffEl.textContent = '-'; diffEl.className = 'st-diff text-xs font-medium text-gray-400'; }
      else if (diff > 0) { diffEl.textContent = '+' + diff; diffEl.className = 'st-diff text-xs font-medium text-green-600'; }
      else { diffEl.textContent = '' + diff; diffEl.className = 'st-diff text-xs font-medium text-red-600'; }
    });
  });
}

function submitStocktake() {
  var inputs = document.querySelectorAll('.st-count');
  var adjustments = [];
  inputs.forEach(function(inp) {
    var sys = parseInt(inp.closest('tr').querySelector('.st-diff').getAttribute('data-sys')) || 0;
    var act = parseInt(inp.value) || 0;
    if (act !== sys) adjustments.push({ item_id: inp.getAttribute('data-id'), actual: act, system: sys });
  });
  if (adjustments.length === 0) { showError('ไม่มีรายการที่ต้องปรับยอด'); return; }
  showConfirm('ยืนยันปรับยอด', 'มี ' + adjustments.length + ' รายการที่ต้องปรับยอด ยืนยัน?', function() {
    showLoading('กำลังปรับยอด...');
    // เรียก backend ทีละรายการ
    var promises = adjustments.map(function(a) {
      return callAPI('updateItem', AUTH.token, a.item_id, { current_stock: a.actual });
    });
    Promise.all(promises).then(function() {
      hideLoading();
      showSuccess('ปรับยอดเรียบร้อย ' + adjustments.length + ' รายการ');
      _itemsCacheTime = 0; // clear cache
      renderStocktake();
    }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาดบางรายการ'); });
  });
}

// ===== PRINT QR LABELS =====
var _printQRFilter = { search:'', category:'all' };
var _printQRMode = 'item'; // 'item' | 'asset'
function renderPrintQRLabels() {
  showLoading('โหลดข้อมูล...');
  var itemsPromise = (_itemsData.length > 0 && (Date.now() - _itemsCacheTime) < ITEMS_CACHE_TTL)
    ? Promise.resolve({ success: true, data: _itemsData })
    : callAPI('getItems', AUTH.token).then(function(res){ _itemsData = res.data||[]; _itemsCacheTime = Date.now(); return res; });
  var assetsPromise = (_assetsCache.length > 0)
    ? Promise.resolve({ success: true, data: _assetsCache })
    : callAPI('getAssets', AUTH.token).then(function(res){ _assetsCache = res.data||[]; return res; });
  Promise.all([itemsPromise, assetsPromise]).then(function(results) {
    hideLoading();
    _itemsData = results[0].data || [];
    _assetsCache = results[1].data || [];
    buildPrintQRPage();
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildPrintQRPage() {
  var isAsset = _printQRMode === 'asset';
  var source = isAsset ? (_assetsCache || []) : (_itemsData || []);
  var filtered = source.filter(function(i) {
    if (!isAsset && i.active === false) return false;
    if (_printQRFilter.search) {
      var term = _printQRFilter.search.toLowerCase();
      var name = (i.name || i.description || '').toLowerCase();
      var code = (i.item_code || i.asset_code || '').toLowerCase();
      if (!name.includes(term) && !code.includes(term)) return false;
    }
    if (!isAsset && _printQRFilter.category !== 'all' && i.category !== _printQRFilter.category) return false;
    return true;
  });
  var cats = isAsset ? [] : getCategoryList(_itemsData);

  var html = '<div class="fade-in space-y-4">';
  // Mode toggle
  html += '<div class="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">';
  html += '<button onclick="setPrintQRMode(\'item\')" class="px-4 py-1.5 text-sm rounded-lg font-medium transition ' + (!isAsset ? 'bg-white text-navy-700 shadow-sm' : 'text-gray-500 hover:text-gray-700') + '"><i class="fi fi-rr-box-open-full mr-1"></i>วัสดุ</button>';
  html += '<button onclick="setPrintQRMode(\'asset\')" class="px-4 py-1.5 text-sm rounded-lg font-medium transition ' + (isAsset ? 'bg-white text-navy-700 shadow-sm' : 'text-gray-500 hover:text-gray-700') + '"><i class="fi fi-rr-box-alt mr-1"></i>ครุภัณฑ์</button>';
  html += '</div>';

  // Toolbar
  html += '<div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">';
  html += '<div class="flex gap-2 flex-wrap">';
  html += '<div class="relative"><i class="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>';
  html += '<input type="text" id="printQRSearch" placeholder="ค้นหา' + (isAsset?'ครุภัณฑ์':'วัสดุ') + '..." value="' + escHtml(_printQRFilter.search) + '" onkeyup="debouncePrintQRFilter()" class="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 w-48"></div>';
  if (!isAsset) {
    html += '<select id="printQRCat" onchange="applyPrintQRFilter()" class="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">';
    html += '<option value="all">ทุกหมวด</option>';
    cats.forEach(function(c){ html += '<option value="' + escHtml(c) + '" ' + (_printQRFilter.category===c?'selected':'') + '>' + escHtml(c) + '</option>'; });
    html += '</select>';
  }
  html += '</div>';
  html += '<div class="flex gap-2">';
  html += '<button onclick="toggleSelectAllQR()" class="btn-secondary btn-sm"><i class="fi fi-rr-check mr-1"></i>เลือกทั้งหมด/ยกเลิก</button>';
  html += '<button onclick="printSelectedQRLabels()" class="btn-primary btn-sm"><i class="fi fi-rr-print mr-1"></i>พิมพ์ที่เลือก</button></div></div>';
  html += '<p class="text-xs text-gray-500">เลือกรายการที่ต้องการพิมพ์แล้วกดปุ่ม พิมพ์ที่เลือก (เลือกได้สูงสุด 20 รายการ/หน้า)</p>';

  // Grid
  html += '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">';
  if (filtered.length === 0) html += '<p class="col-span-full text-center text-gray-400 py-10">ไม่พบรายการ</p>';
  filtered.forEach(function(item) {
    var img = isAsset ? '' : imgUrl(item.image_file_id);
    var iconClass = isAsset ? 'fi fi-rr-box-alt' : 'fi fi-rr-box-open-full';
    var imgHtml = img ? '<img src="' + img + '" class="w-10 h-10 object-cover rounded-lg border border-gray-200">' : '<div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><i class="' + iconClass + ' text-gray-400 text-sm"></i></div>';
    var name = isAsset ? (item.description || item.asset_code) : item.name;
    var code = isAsset ? item.asset_code : item.item_code;
    html += '<label class="card p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow" onclick="event.stopPropagation()">';
    html += '<input type="checkbox" class="qr-print-check w-4 h-4 accent-navy-600 flex-shrink-0" data-id="' + item.id + '" data-type="' + (isAsset?'asset':'item') + '">';
    html += imgHtml;
    html += '<div class="min-w-0"><p class="text-sm font-medium text-gray-800 truncate">' + escHtml(name) + '</p>';
    html += '<p class="text-xs text-gray-500">' + escHtml(code||'') + '</p></div>';
    html += '</label>';
  });
  html += '</div></div>';
  document.getElementById('mainContent').innerHTML = html;
}
function setPrintQRMode(mode) { _printQRMode = mode; buildPrintQRPage(); }

var _printQRFilterTimer;
function debouncePrintQRFilter() { clearTimeout(_printQRFilterTimer); _printQRFilterTimer = setTimeout(applyPrintQRFilter, 300); }
function applyPrintQRFilter() {
  _printQRFilter.search   = (document.getElementById('printQRSearch')||{}).value||'';
  _printQRFilter.category = (document.getElementById('printQRCat')||{}).value||'all';
  buildPrintQRPage();
}
function toggleSelectAllQR() {
  var checks = document.querySelectorAll('.qr-print-check');
  var allChecked = Array.prototype.every.call(checks, function(c){ return c.checked; });
  checks.forEach(function(c){ c.checked = !allChecked; });
}

function printSelectedQRLabels() {
  var selected = [];
  document.querySelectorAll('.qr-print-check:checked').forEach(function(c) {
    var id = c.getAttribute('data-id');
    var type = c.getAttribute('data-type');
    var source = type === 'asset' ? _assetsCache : _itemsData;
    var item = source.find(function(i){ return i.id === id; });
    if (item) selected.push({ data: item, type: type });
  });
  if (selected.length === 0) { showError('กรุณาเลือกอย่างน้อย 1 รายการ'); return; }

  var baseUrl = window.location.origin + window.location.pathname;
  var win = window.open('', '_blank');
  var css = 'body{font-family:sarabun,sans-serif;margin:0;padding:8mm;background:#fff}' +
    '@media print{@page{size:A4;margin:8mm}}' +
    '.sheet{display:flex;flex-wrap:wrap;gap:5mm;justify-content:flex-start}' +
    '.label{width:50mm;height:40mm;border:1px solid #ccc;padding:3mm;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-inside:avoid}' +
    '.name{font-size:10px;font-weight:700;color:#1a2566;margin:0 0 1mm;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.meta{font-size:8px;color:#666;margin:0 0 1.5mm}' +
    '.qr-wrap{width:22mm;height:22mm}';

  var bodyHtml = '<div class="sheet">';
  selected.forEach(function(s) {
    var item = s.data;
    var isAsset = s.type === 'asset';
    var qrUrl = isAsset ? baseUrl + '?public_asset_id=' + item.id : baseUrl + '?action=withdraw&item_id=' + item.id;
    var name = isAsset ? (item.description || item.asset_code) : item.name;
    var code = isAsset ? item.asset_code : item.item_code;
    var extra = isAsset ? '' : (item.size || '');
    var uid = s.type + '_' + item.id;
    bodyHtml += '<div class="label">';
    bodyHtml += '<p class="name">' + escHtml(name) + '</p>';
    bodyHtml += '<p class="meta">' + escHtml(code) + (extra ? ' • ' + escHtml(extra) : '') + '</p>';
    bodyHtml += '<div class="qr-wrap" id="qr_' + uid + '"></div>';
    bodyHtml += '</div>';
  });
  bodyHtml += '</div>';

  var scriptHtml = '';
  selected.forEach(function(s) {
    var item = s.data;
    var isAsset = s.type === 'asset';
    var qrUrl = isAsset ? baseUrl + '?public_asset_id=' + item.id : baseUrl + '?action=withdraw&item_id=' + item.id;
    var uid = s.type + '_' + item.id;
    scriptHtml += 'new QRCode(document.getElementById("qr_' + uid + '"),{text:"' + qrUrl + '",width:80,height:80,colorDark:"#1a2566",correctLevel:QRCode.CorrectLevel.M});';
  });

  win.document.write('<html><head><title>พิมพ์ QR สติ๊กเกอร์</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">'
    + '<style>' + css + '</style></head><body>' + bodyHtml
    + '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>'
    + '<script>' + scriptHtml + 'setTimeout(function(){window.print();},' + (selected.length * 150 + 300) + ');<\/script>'
    + '</body></html>');
  win.document.close();
}

// ===== WITHDRAW =====
var _wdData   = [];
var _wdPage   = 1;
var _wdFilter = 'all';

function renderWithdraw() {
  showLoading('โหลดข้อมูล...');
  var itemsPromise = (_itemsData.length > 0 && (Date.now() - _itemsCacheTime) < ITEMS_CACHE_TTL)
    ? Promise.resolve({ success: true, data: _itemsData })
    : callAPI('getItems', AUTH.token).then(function(res){ _itemsData = res.data||[]; _itemsCacheTime = Date.now(); return res; });
  Promise.all([ itemsPromise, callAPI('getWithdrawals', AUTH.token, { status:'all' }) ]).then(function(results) {
    hideLoading();
    _itemsData = results[0].data || [];
    _wdData    = results[1].data || [];
    _wdPage    = 1;
    buildWithdrawPage();
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildWithdrawPage() {
  var filtered = _wdFilter === 'all' ? _wdData : _wdData.filter(function(w){ return w.status === _wdFilter; });
  var paged    = paginate(filtered, _wdPage);

  var html = '<div class="fade-in space-y-4">';
  html += '<div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">';
  html += '<h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-inbox-out text-navy-600"></i> รายการคำขอเบิกวัสดุ</h3>';
  html += '<button onclick="openWithdrawSelectModal()" class="btn-primary flex items-center gap-2"><i class="fi fi-rr-plus"></i> ยื่นคำขอเบิก</button></div>';

  html += '<div class="flex gap-2 border-b">';
  ['all','pending','approved','rejected'].forEach(function(s) {
    var labels = { all:'ทั้งหมด', pending:'รออนุมัติ', approved:'อนุมัติแล้ว', rejected:'ปฏิเสธ' };
    var count  = s === 'all' ? _wdData.length : _wdData.filter(function(w){ return w.status===s; }).length;
    html += '<button onclick="setWdFilter(\'' + s + '\')" class="pb-2.5 px-3 text-sm font-medium border-b-2 transition '
      + (_wdFilter===s ? 'border-navy-700 text-navy-700' : 'border-transparent text-gray-500 hover:text-gray-700') + '">'
      + labels[s] + ' <span class="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">' + count + '</span></button>';
  });
  html += '</div>';

  html += '<div class="card overflow-hidden"><div class="overflow-x-auto">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
  html += '<tr><th class="px-4 py-3 text-left">เลขที่เบิก</th><th class="px-4 py-3 text-left">วันที่</th>';
  html += '<th class="px-4 py-3 text-left">รายการ</th><th class="px-4 py-3 text-center">ขอ/อนุมัติ</th>';
  html += '<th class="px-4 py-3 text-left">วัตถุประสงค์</th><th class="px-4 py-3 text-left">ผู้ขอ</th>';
  html += '<th class="px-4 py-3 text-center">สถานะ</th>';
  html += '<th class="px-4 py-3 text-center">จัดการ</th>';
  html += '</tr></thead><tbody class="divide-y divide-gray-100">';

  if (paged.length === 0) {
    html += '<tr><td colspan="8" class="text-center py-10 text-gray-400">ไม่พบรายการ</td></tr>';
  }
  paged.forEach(function(w) {
    var badgeClass = w.status==='approved'?'badge-approved':w.status==='rejected'?'badge-rejected':'badge-pending';
    var statusLabel = { pending:'รออนุมัติ', approved:'อนุมัติแล้ว', rejected:'ปฏิเสธ' }[w.status]||w.status;
    html += '<tr>';
    html += '<td class="px-4 py-2.5 font-mono text-xs text-navy-700">' + escHtml(w.withdraw_no) + (w.via_qr?'<span class="ml-1 text-teal-600 text-xs" title="สแกน QR"><i class="fi fi-rr-qr-scan"></i></span>':'') + '</td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-500">' + formatDate(w.requested_at) + '</td>';
    html += '<td class="px-4 py-2.5 font-medium text-gray-700 max-w-xs truncate">' + escHtml(w.item_name) + '</td>';
    html += '<td class="px-4 py-2.5 text-center text-xs"><span class="text-gray-800 font-bold">' + w.quantity_requested + '</span>';
    if (w.status==='approved') html += '<span class="text-green-600 ml-1">/' + w.quantity_approved + '</span>';
    html += ' <span class="text-gray-400">' + escHtml(w.unit) + '</span></td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-500 max-w-xs truncate">' + escHtml(w.purpose||'-') + '</td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-600">' + escHtml(w.requested_by_name||'-') + '</td>';
    html += '<td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-medium ' + badgeClass + '">' + statusLabel + '</span></td>';
    html += '<td class="px-4 py-2.5 text-center"><div class="flex gap-1 justify-center">';
    if (w.status === 'pending') {
      if (AUTH.user.role === 'admin') {
        html += '<button onclick="openApproveModal(\'' + w.id + '\',' + w.quantity_requested + ')" class="btn-success btn-sm text-xs"><i class="fi fi-rr-check mr-1"></i>อนุมัติ</button>';
        html += '<button onclick="openRejectModal(\'' + w.id + '\')" class="btn-danger btn-sm text-xs"><i class="fi fi-rr-cross mr-1"></i>ปฏิเสธ</button>';
      }
      if (w.requested_by === AUTH.user.id) {
        html += '<button onclick="doCancelWithdrawal(\'' + w.id + '\')" class="btn-secondary btn-sm text-xs"><i class="fi fi-rr-cross mr-1"></i>ยกเลิก</button>';
      }
    } else {
      html += '<span class="text-xs text-gray-400">—</span>';
    }
    html += '</div></td>';
    html += '</tr>';
  });
  html += '</tbody></table></div></div>';

  html += '<div class="md:hidden space-y-3" id="wdMobileCards">';
  paged.forEach(function(w) {
    var badgeClass = w.status==='approved'?'badge-approved':w.status==='rejected'?'badge-rejected':'badge-pending';
    var statusLabel = { pending:'รออนุมัติ', approved:'อนุมัติแล้ว', rejected:'ปฏิเสธ' }[w.status]||w.status;
    html += '<div class="card p-4 space-y-2">';
    html += '<div class="flex items-start justify-between">';
    html += '<div><p class="font-semibold text-gray-800 text-sm">' + escHtml(w.item_name) + '</p>';
    html += '<p class="text-xs text-navy-700 font-mono">' + escHtml(w.withdraw_no) + '</p></div>';
    html += '<span class="px-2 py-0.5 rounded-full text-xs font-medium ' + badgeClass + '">' + statusLabel + '</span></div>';
    html += '<div class="grid grid-cols-2 gap-1 text-xs text-gray-500">';
    html += '<span><i class="fi fi-rr-calendar-day mr-1"></i>' + formatDate(w.requested_at) + '</span>';
    html += '<span><i class="fi fi-rr-layers mr-1"></i>' + w.quantity_requested + ' ' + escHtml(w.unit) + '</span>';
    html += '<span><i class="fi fi-rr-user mr-1"></i>' + escHtml(w.requested_by_name||'-') + '</span>';
    html += '<span><i class="fi fi-rr-target mr-1"></i>' + escHtml(w.purpose||'-') + '</span></div>';
    if (w.status === 'pending') {
      html += '<div class="flex gap-2 pt-1">';
      if (AUTH.user.role === 'admin') {
        html += '<button onclick="openApproveModal(\'' + w.id + '\',' + w.quantity_requested + ')" class="flex-1 btn-success btn-sm text-xs">อนุมัติ</button>';
        html += '<button onclick="openRejectModal(\'' + w.id + '\')" class="flex-1 btn-danger btn-sm text-xs">ปฏิเสธ</button>';
      }
      if (w.requested_by === AUTH.user.id) {
        html += '<button onclick="doCancelWithdrawal(\'' + w.id + '\')" class="flex-1 btn-secondary btn-sm text-xs"><i class="fi fi-rr-cross mr-1"></i>ยกเลิก</button>';
      }
      html += '</div>';
    }
    html += '</div>';
  });
  html += '</div>';

  html += '<div id="wdPagination"></div></div>';
  document.getElementById('mainContent').innerHTML = html;
  renderPagination('wdPagination', filtered.length, _wdPage, function(p){ _wdPage=p; buildWithdrawPage(); });
}

function setWdFilter(f) { _wdFilter=f; _wdPage=1; buildWithdrawPage(); }

function openWithdrawSelectModal() {
  if (_itemsData.length === 0) {
    showLoading('โหลด...');
    callAPI('getItems', AUTH.token).then(function(res){ hideLoading(); _itemsData = res.data||[]; _openWdSelect(); });
  } else _openWdSelect();
}
function _openWdSelect() {
  var body = '<div class="space-y-3">'
    + '<div class="flex gap-2">'
    + '<div class="relative flex-1"><i class="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>'
    + '<input type="text" id="wdItemSearch" placeholder="ค้นหาวัสดุ..." onkeyup="filterWdItemList()" class="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"></div>'
    + '<button onclick="startWdQRScanner()" class="btn-primary px-3 py-2.5 rounded-xl" title="สแกน QR"><i class="fi fi-rr-qr-scan text-lg"></i></button></div>'
    + '<div id="wdItemList" class="max-h-72 overflow-y-auto space-y-1">' + buildWdItemList(_itemsData) + '</div>'
    + '<div id="wdQRReader" class="hidden"></div></div>';
  openModal('เลือกรายการวัสดุที่ต้องการเบิก', body, '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>');
}
function startWdQRScanner() {
  document.getElementById('wdItemSearch').parentNode.parentNode.classList.add('hidden');
  document.getElementById('wdItemList').classList.add('hidden');
  var qrDiv = document.getElementById('wdQRReader');
  qrDiv.classList.remove('hidden');
  qrDiv.innerHTML = '<div class="text-center py-4"><div id="wd-qr-reader" class="mx-auto" style="width:280px"></div><button onclick="stopWdQRScanner()" class="btn-secondary btn-sm mt-3"><i class="fi fi-rr-cross mr-1"></i>ปิดกล้อง</button></div>';
  setTimeout(function() {
    try {
      _qrScanner = new Html5Qrcode('wd-qr-reader');
      _qrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        function(decodedText) {
          stopWdQRScanner();
          try {
            var url = new URL(decodedText);
            var action = url.searchParams.get('action');
            var itemId = url.searchParams.get('item_id');
            if (action === 'withdraw' && itemId) {
              closeModal();
              openWithdrawFromQR(itemId);
            } else {
              showError('QR Code ไม่ถูกต้อง');
              stopWdQRScanner();
            }
          } catch(e) {
            showError('QR Code ไม่ถูกต้อง');
            stopWdQRScanner();
          }
        },
        function(errorMessage) {}
      ).catch(function(err) {
        console.error(err);
        showError('ไม่สามารถเปิดกล้องได้');
      });
    } catch(e) {
      console.error(e);
      showError('เบราว์เซอร์นี้ไม่รองรับการใช้งานกล้อง');
    }
  }, 200);
}
function stopWdQRScanner() {
  if (_qrScanner) {
    _qrScanner.stop().then(function() {
      _qrScanner = null;
      document.getElementById('wdItemSearch').parentNode.parentNode.classList.remove('hidden');
      document.getElementById('wdItemList').classList.remove('hidden');
      document.getElementById('wdQRReader').classList.add('hidden');
    }).catch(function() {
      _qrScanner = null;
      document.getElementById('wdItemSearch').parentNode.parentNode.classList.remove('hidden');
      document.getElementById('wdItemList').classList.remove('hidden');
      document.getElementById('wdQRReader').classList.add('hidden');
    });
  } else {
    document.getElementById('wdItemSearch').parentNode.parentNode.classList.remove('hidden');
    document.getElementById('wdItemList').classList.remove('hidden');
    document.getElementById('wdQRReader').classList.add('hidden');
  }
}
function buildWdItemList(data) {
  if (data.length === 0) return '<p class="text-center text-sm text-gray-400 py-4">ไม่พบรายการ</p>';
  return data.map(function(i) {
    var sClass = getStockClass(i.current_stock, i.min_stock);
    var imgUrlSrc = imgUrl(i.image_file_id);
    var imgHtml = imgUrlSrc ? '<img src="' + imgUrlSrc + '" class="w-9 h-9 object-cover rounded-xl border border-gray-200 flex-shrink-0" loading="lazy">' : '<div class="w-9 h-9 bg-navy-100 rounded-xl flex items-center justify-center flex-shrink-0"><i class="fi fi-rr-box-open-full text-navy-700 text-sm"></i></div>';
    return '<div onclick="selectWdItem(\'' + i.id + '\')" class="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-navy-50 border border-transparent hover:border-navy-200 transition">'
      + imgHtml
      + '<div class="flex-1 min-w-0"><p class="text-sm font-medium text-gray-700 truncate">' + escHtml(i.name) + '</p>'
      + '<p class="text-xs text-gray-400">' + escHtml(i.item_code) + ' • ' + escHtml(i.size||'') + ' • ' + i.current_stock + ' ' + i.unit + '</p></div>'
      + '<span class="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ' + sClass + '">' + getStockLabel(i.current_stock, i.min_stock) + '</span></div>';
  }).join('');
}
function filterWdItemList() {
  var q = (document.getElementById('wdItemSearch')||{}).value||'';
  var filtered = _itemsData.filter(function(i){ return !q || i.name.toLowerCase().includes(q.toLowerCase()) || (i.item_code||'').includes(q); });
  document.getElementById('wdItemList').innerHTML = buildWdItemList(filtered);
}
function selectWdItem(id) {
  closeModal();
  openWithdrawModal(id);
}

function openWithdrawModal(itemId) {
  var item = _itemsData.find(function(i){ return i.id === itemId; });
  if (!item) return;
  var body = '<div class="space-y-4">';
  body += '<input type="hidden" id="wdItemId" value="' + itemId + '">';
  body += '<input type="hidden" id="wdViaQr" value="false">';
  body += '<p class="text-sm text-gray-600">รายการ: <b>' + escHtml(item.name) + '</b> (คงเหลือ ' + item.current_stock + ' ' + item.unit + ')</p>';
  body += fieldHTML('จำนวนที่ต้องการเบิก *', 'wdQty', 'number', 1);
  body += '<div class="sm:col-span-2"><label class="form-label">วัตถุประสงค์ *</label><input type="text" id="wdPurpose" class="form-input" placeholder="ระบุวัตถุประสงค์..."></div>';
  body += '<div class="sm:col-span-2"><label class="form-label">หมายเหตุ</label><textarea id="wdNote" class="form-input" rows="2"></textarea></div>';
  body += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>'
    + '<button onclick="submitWithdraw()" class="btn-primary"><i class="fi fi-rr-inbox-out mr-1"></i>ยื่นคำขอเบิก</button>';
  openModal('เบิกวัสดุ', body, footer);
}

function openWithdrawFromQR(itemId) {
  showLoading('โหลดข้อมูล...');
  function _build(item) {
    hideLoading();
    var img = imgUrl(item.image_file_id);
    var body = '<div class="space-y-4">';
    body += '<input type="hidden" id="wdItemId" value="' + itemId + '">';
    body += '<input type="hidden" id="wdViaQr" value="true">';
    if (img) body += '<div class="flex justify-center"><img src="' + img + '" class="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-sm"></div>';
    body += '<p class="text-sm text-gray-600 text-center">รายการ: <b>' + escHtml(item.name) + '</b> (คงเหลือ ' + item.current_stock + ' ' + item.unit + ')</p>';
    body += fieldHTML('จำนวนที่ต้องการเบิก *', 'wdQty', 'number', 1);
    body += '<div class="sm:col-span-2"><label class="form-label">วัตถุประสงค์ *</label><input type="text" id="wdPurpose" class="form-input" placeholder="ระบุวัตถุประสงค์..."></div>';
    body += '<div class="sm:col-span-2"><label class="form-label">หมายเหตุ</label><textarea id="wdNote" class="form-input" rows="2"></textarea></div>';
    body += '</div>';
    var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>'
      + '<button onclick="submitWithdraw()" class="btn-primary"><i class="fi fi-rr-inbox-out mr-1"></i>ยื่นคำขอเบิก</button>';
    openModal('เบิกวัสดุ (QR)', body, footer);
  }
  // reuse cache ถ้ามี
  if (_itemsData.length > 0 && (Date.now() - _itemsCacheTime) < ITEMS_CACHE_TTL) {
    var item = _itemsData.find(function(i){ return i.id == itemId; });
    if (!item) item = _itemsData.find(function(i){ return i.item_code === itemId; });
    if (item) { _build(item); return; }
  }
  callAPI('getItems', AUTH.token).then(function(res) {
    _itemsData = res.data || [];
    _itemsCacheTime = Date.now();
    var item = _itemsData.find(function(i){ return i.id == itemId; });
    if (!item) item = _itemsData.find(function(i){ return i.item_code === itemId; });
    if (!item) { hideLoading(); showError('ไม่พบรายการวัสดุจาก QR (ID: ' + itemId + ')'); return; }
    _build(item);
  }).catch(function(){ hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function submitWithdraw() {
  var itemId  = (document.getElementById('wdItemId')||{}).value||'';
  var qty     = parseInt((document.getElementById('wdQty')||{}).value||0);
  var purpose = (document.getElementById('wdPurpose')||{}).value||'';
  var note    = (document.getElementById('wdNote')||{}).value||'';
  var viaQr   = (document.getElementById('wdViaQr')||{}).value==='true';
  if (!itemId) { showError('ไม่พบรายการวัสดุ'); return; }
  if (!qty || qty <= 0) { showError('กรุณาระบุจำนวนที่ถูกต้อง'); return; }
  if (!purpose) { showError('กรุณาระบุวัตถุประสงค์'); return; }
  showLoading('กำลังยื่นคำขอ...');
  callAPI('addWithdrawal', AUTH.token, { item_id:itemId, quantity:qty, purpose:purpose, note:note, via_qr:viaQr }).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) {
      showSuccess('ยื่นคำขอ ' + res.withdraw_no + ' เรียบร้อย รอการอนุมัติ');
      if (_currentPage === 'withdraw') renderWithdraw();
      else if (_currentPage === 'dashboard') renderDashboard();
    } else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}

// ===== APPROVE =====
var _approveData = [];
var _approvePage = 1;

function renderApprove() {
  if (AUTH.user.role !== 'admin') { loadPage('dashboard'); return; }
  showLoading('โหลดคำขอเบิก...');
  callAPI('getWithdrawals', AUTH.token, { status:'all' }).then(function(res) {
    hideLoading();
    _approveData = res.data || [];
    _approvePage = 1;
    buildApprovePage('pending');
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildApprovePage(filterStatus) {
  filterStatus = filterStatus || 'pending';
  var data    = _approveData.filter(function(w){ return filterStatus==='all'?true:w.status===filterStatus; });
  var paged   = paginate(data, _approvePage);
  var pendingCount = _approveData.filter(function(w){ return w.status==='pending'; }).length;

  var html = '<div class="fade-in space-y-4">';
  html += '<div class="flex items-center justify-between">';
  html += '<h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-check-circle text-navy-600"></i> อนุมัติการเบิกวัสดุ';
  if (pendingCount > 0) html += ' <span class="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">' + pendingCount + '</span>';
  html += '</h3>';
  html += '<div class="flex gap-2">';
  ['pending','approved','rejected','all'].forEach(function(s){
    var labels = {pending:'รอดำเนินการ',approved:'อนุมัติแล้ว',rejected:'ปฏิเสธแล้ว',all:'ทั้งหมด'};
    html += '<button onclick="buildApprovePage(\'' + s + '\')" class="px-3 py-1.5 rounded-xl text-xs font-medium border transition '
      + (filterStatus===s?'bg-navy-700 text-white border-navy-700':'border-gray-300 text-gray-600 hover:bg-gray-50') + '">' + labels[s] + '</button>';
  });
  html += '</div></div>';

  if (paged.length === 0) {
    html += '<div class="card p-12 text-center"><i class="fi fi-rr-check-circle text-5xl text-green-400 block mb-3"></i><p class="text-gray-500">ไม่มีรายการ' + (filterStatus==='pending'?' รออนุมัติ':'') + '</p></div>';
  } else {
    paged.forEach(function(w) {
      var badgeClass = w.status==='approved'?'badge-approved':w.status==='rejected'?'badge-rejected':'badge-pending';
      var statusLabel = {pending:'รออนุมัติ',approved:'อนุมัติแล้ว',rejected:'ปฏิเสธ'}[w.status]||w.status;
      html += '<div class="card p-4 flex flex-col sm:flex-row sm:items-center gap-4">';
      html += '<div class="w-12 h-12 bg-' + (w.status==='pending'?'amber':'gray') + '-100 rounded-xl flex items-center justify-center flex-shrink-0">';
      html += '<i class="fi fi-rr-inbox-out text-' + (w.status==='pending'?'amber':'gray') + '-600 text-xl"></i></div>';
      html += '<div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2 mb-1">';
      html += '<span class="font-bold text-gray-800 text-sm">' + escHtml(w.item_name) + '</span>';
      html += '<span class="font-mono text-xs text-navy-600">#' + escHtml(w.withdraw_no) + '</span>';
      html += '<span class="px-2 py-0.5 rounded-full text-xs font-medium ' + badgeClass + '">' + statusLabel + '</span>';
      if (w.via_qr) html += '<span class="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full"><i class="fi fi-rr-qr-scan mr-0.5"></i>QR</span>';
      html += '</div>';
      html += '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">';
      html += '<span><i class="fi fi-rr-user mr-1"></i>' + escHtml(w.requested_by_name||'-') + '</span>';
      html += '<span><i class="fi fi-rr-layers mr-1"></i>' + w.quantity_requested + ' ' + escHtml(w.unit) + '</span>';
      html += '<span><i class="fi fi-rr-target mr-1"></i>' + escHtml(w.purpose||'-') + '</span>';
      html += '<span><i class="fi fi-rr-calendar-day mr-1"></i>' + formatDate(w.requested_at) + '</span>';
      html += '</div>';
      if (w.status === 'approved') {
        html += '<p class="text-xs text-green-700 mt-1"><i class="fi fi-rr-check mr-1"></i>อนุมัติ ' + w.quantity_approved + ' ' + w.unit + ' โดย ' + escHtml(w.approved_by_name||'-') + ' เมื่อ ' + formatDate(w.approved_at) + '</p>';
      }
      if (w.status === 'rejected' && w.reject_reason) {
        html += '<p class="text-xs text-red-700 mt-1"><i class="fi fi-rr-cross mr-1"></i>เหตุผล: ' + escHtml(w.reject_reason) + '</p>';
      }
      html += '</div>';
      if (w.status === 'pending') {
        html += '<div class="flex gap-2 flex-shrink-0">';
        html += '<button onclick="openApproveModal(\'' + w.id + '\',' + w.quantity_requested + ')" class="btn-success flex items-center gap-1.5"><i class="fi fi-rr-check"></i> อนุมัติ</button>';
        html += '<button onclick="openRejectModal(\'' + w.id + '\')" class="btn-danger flex items-center gap-1.5"><i class="fi fi-rr-cross"></i> ปฏิเสธ</button>';
        html += '</div>';
      }
      html += '</div>';
    });
  }
  html += '<div id="approvePagination"></div></div>';
  document.getElementById('mainContent').innerHTML = html;
  renderPagination('approvePagination', data.length, _approvePage, function(p){ _approvePage=p; buildApprovePage(filterStatus); });
}

function openApproveModal(wdId, qty) {
  var wd = _approveData.find(function(w){ return w.id === wdId; });
  var item = wd && _itemsData.find(function(i){ return i.id === wd.item_id; });
  var img = item ? imgUrl(item.image_file_id) : '';
  var imgHtml = img ? '<div class="flex justify-center"><img src="' + img + '" class="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-sm"></div>' : '';
  var body = '<div class="space-y-4">';
  body += imgHtml;
  body += '<div class="text-center"><p class="font-semibold text-gray-800">' + escHtml((wd && wd.item_name) || '-') + '</p>';
  body += '<p class="text-xs text-gray-500">ผู้ขอเบิก: <b>' + escHtml((wd && wd.requested_by_name) || '-') + '</b> • วัตถุประสงค์: ' + escHtml((wd && wd.purpose) || '-') + '</p></div>';
  body += '<div><label class="form-label">จำนวนที่อนุมัติ *</label>';
  body += '<input type="number" id="approveQty" value="' + qty + '" min="1" max="' + qty + '" class="form-input">';
  body += '<p class="text-xs text-gray-400 mt-1">จำนวนที่ขอ: ' + qty + ' ' + escHtml((wd && wd.unit) || '') + '</p></div></div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>'
    + '<button onclick="doApprove(\'' + wdId + '\')" class="btn-success"><i class="fi fi-rr-check mr-1"></i>ยืนยันอนุมัติ</button>';
  openModal('อนุมัติการเบิก', body, footer);
}

function doApprove(wdId) {
  var qty = parseInt((document.getElementById('approveQty')||{}).value||0);
  if (!qty || qty <= 0) { showError('กรุณาระบุจำนวน'); return; }
  closeModal();
  showLoading('กำลังอนุมัติ...');
  callAPI('approveWithdrawal', AUTH.token, wdId, qty).then(function(res) {
    hideLoading();
    if (res.success) { showSuccess(res.message); renderApprove(); }
    else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}

function openRejectModal(wdId) {
  var body = '<div class="space-y-3">'
    + '<p class="text-sm text-gray-600">กรุณาระบุเหตุผลที่ปฏิเสธคำขอเบิกนี้</p>'
    + '<div><label class="form-label">เหตุผล *</label>'
    + '<input type="text" id="rejectReason" placeholder="ระบุเหตุผล..." class="form-input"></div></div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>'
    + '<button onclick="doReject(\'' + wdId + '\')" class="btn-danger"><i class="fi fi-rr-cross mr-1"></i>ยืนยันปฏิเสธ</button>';
  openModal('ปฏิเสธคำขอเบิก', body, footer);
}

function doReject(wdId) {
  var reason = (document.getElementById('rejectReason')||{}).value||'';
  if (!reason.trim()) { showError('กรุณาระบุเหตุผล'); return; }
  closeModal();
  showLoading('กำลังดำเนินการ...');
  callAPI('rejectWithdrawal', AUTH.token, wdId, reason).then(function(res) {
    hideLoading();
    if (res.success) { showSuccess(res.message); renderApprove(); }
    else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}

function doCancelWithdrawal(wdId) {
  showConfirm('ยืนยันยกเลิก', 'ยกเลิกคำขอเบิกนี้?', function() {
    showLoading('กำลังยกเลิก...');
    callAPI('cancelWithdrawal', AUTH.token, wdId).then(function(res) {
      hideLoading();
      if (res.success) { showSuccess(res.message); renderWithdraw(); }
      else showError(res.message);
    }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
  });
}

// ===== TRANSACTIONS =====
var _txData   = [];
var _txPage   = 1;
var _txFilter = { type:'all', date_from:'', date_to:'' };

function renderTransactions() {
  showLoading('โหลดประวัติ...');
  callAPI('getTransactions', AUTH.token, {}).then(function(res) {
    hideLoading();
    _txData = res.data || [];
    _txPage = 1;
    buildTransactionsPage();
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildTransactionsPage() {
  var filtered = applyTxFilter(_txData);
  var paged    = paginate(filtered, _txPage);

  var html = '<div class="fade-in space-y-4">';
  html += '<div class="card p-4"><div class="flex flex-wrap gap-3 items-end">';
  html += '<div><label class="form-label">ประเภท</label><select id="txTypeFilter" onchange="applyTxFilterUI()" class="form-input w-36">';
  ['all','receive','withdraw'].forEach(function(t){
    var labels={all:'ทั้งหมด',receive:'รับเข้า',withdraw:'เบิกออก'};
    html += '<option value="' + t + '" ' + (_txFilter.type===t?'selected':'') + '>' + labels[t] + '</option>';
  });
  html += '</select></div>';
  html += '<div><label class="form-label">จากวันที่</label><input type="date" id="txDateFrom" value="' + _txFilter.date_from + '" onchange="applyTxFilterUI()" class="form-input w-40"></div>';
  html += '<div><label class="form-label">ถึงวันที่</label><input type="date" id="txDateTo" value="' + _txFilter.date_to + '" onchange="applyTxFilterUI()" class="form-input w-40"></div>';
  html += '<button onclick="clearTxFilter()" class="btn-secondary btn-sm"><i class="fi fi-rr-refresh mr-1"></i>ล้างตัวกรอง</button>';
  html += '</div></div>';

  var totalR = filtered.filter(function(t){ return t.type==='receive'; }).length;
  var totalW = filtered.filter(function(t){ return t.type==='withdraw'; }).length;
  html += '<div class="flex gap-2 text-xs">';
  html += '<span class="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full"><i class="fi fi-rr-inbox-in mr-1"></i>รับเข้า: ' + totalR + '</span>';
  html += '<span class="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full"><i class="fi fi-rr-inbox-out mr-1"></i>เบิกออก: ' + totalW + '</span>';
  html += '<span class="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full">ทั้งหมด: ' + filtered.length + '</span></div>';

  html += '<div class="card overflow-hidden"><div class="overflow-x-auto">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
  html += '<tr><th class="px-4 py-3 text-left">วันที่</th><th class="px-4 py-3 text-center">ประเภท</th>';
  html += '<th class="px-4 py-3 text-left">เลขที่อ้างอิง</th><th class="px-4 py-3 text-left">รายการ</th>';
  html += '<th class="px-4 py-3 text-center">จำนวน</th><th class="px-4 py-3 text-center">ก่อน</th>';
  html += '<th class="px-4 py-3 text-center">หลัง</th><th class="px-4 py-3 text-left">ผู้ดำเนินการ</th></tr></thead>';
  html += '<tbody class="divide-y divide-gray-100">';
  if (paged.length === 0) html += '<tr><td colspan="8" class="text-center py-10 text-gray-400">ไม่พบรายการ</td></tr>';
  paged.forEach(function(t) {
    var isR = t.type === 'receive';
    html += '<tr>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">' + formatDate(t.date) + '</td>';
    html += '<td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-medium ' + (isR?'badge-receive':'badge-withdraw') + '">' + (isR?'รับเข้า':'เบิกออก') + '</span></td>';
    html += '<td class="px-4 py-2.5 font-mono text-xs text-navy-700">' + escHtml(t.ref_id||'-') + '</td>';
    html += '<td class="px-4 py-2.5 font-medium text-gray-700 max-w-xs">' + escHtml(t.item_name||'-') + '</td>';
    html += '<td class="px-4 py-2.5 text-center font-bold ' + (isR?'text-blue-700':'text-purple-700') + '">' + (isR?'+':'-') + t.quantity + '</td>';
    html += '<td class="px-4 py-2.5 text-center text-xs text-gray-500">' + (t.stock_before||0) + '</td>';
    html += '<td class="px-4 py-2.5 text-center text-xs font-bold text-gray-700">' + (t.stock_after||0) + '</td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-500">' + escHtml(t.actor_name||'-') + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div></div>';
  html += '<div id="txPagination"></div></div>';
  document.getElementById('mainContent').innerHTML = html;
  renderPagination('txPagination', filtered.length, _txPage, function(p){ _txPage=p; buildTransactionsPage(); });
}

function applyTxFilter(data) {
  return data.filter(function(t) {
    if (_txFilter.type !== 'all' && t.type !== _txFilter.type) return false;
    if (_txFilter.date_from && (t.date||'') < _txFilter.date_from) return false;
    if (_txFilter.date_to   && (t.date||'') > _txFilter.date_to)   return false;
    return true;
  });
}
function applyTxFilterUI() {
  _txFilter.type      = (document.getElementById('txTypeFilter')||{}).value||'all';
  _txFilter.date_from = (document.getElementById('txDateFrom')||{}).value||'';
  _txFilter.date_to   = (document.getElementById('txDateTo')||{}).value||'';
  _txPage = 1;
  buildTransactionsPage();
}
function clearTxFilter() {
  _txFilter = { type:'all', date_from:'', date_to:'' };
  _txPage   = 1;
  buildTransactionsPage();
}

// ===== REPORTS =====
var _reportCharts = {};

function renderReports() {
  var now = new Date();
  var html = '<div class="fade-in space-y-4">';
  html += '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">';

  html += '<div class="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">';
  html += '<div class="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center"><i class="fi fi-rr-inbox-in text-blue-600 text-xl"></i></div>';
  html += '<div><p class="font-semibold text-gray-800">รายงานรับวัสดุเข้า</p><p class="text-xs text-gray-400 mt-0.5">ประวัติการรับวัสดุทั้งหมด</p></div>';
  html += '<button onclick="loadReceiveReport()" class="btn-primary btn-sm mt-auto"><i class="fi fi-rr-eye mr-1"></i>ดูรายงาน</button></div>';

  html += '<div class="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">';
  html += '<div class="w-11 h-11 bg-purple-100 rounded-xl flex items-center justify-center"><i class="fi fi-rr-inbox-out text-purple-600 text-xl"></i></div>';
  html += '<div><p class="font-semibold text-gray-800">รายงานเบิกวัสดุออก</p><p class="text-xs text-gray-400 mt-0.5">ประวัติการเบิกและอนุมัติ</p></div>';
  html += '<button onclick="loadWithdrawReport()" class="btn-primary btn-sm mt-auto"><i class="fi fi-rr-eye mr-1"></i>ดูรายงาน</button></div>';

  html += '<div class="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">';
  html += '<div class="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center"><i class="fi fi-rr-calendar text-green-600 text-xl"></i></div>';
  html += '<div><p class="font-semibold text-gray-800">สรุปรายเดือน</p><p class="text-xs text-gray-400 mt-0.5">ยอดรับ-เบิกตาราง Matrix</p></div>';
  html += '<div class="flex gap-2 mt-auto">';
  html += '<select id="rptYear" class="form-input flex-1 text-xs">';
  for (var y = now.getFullYear(); y >= now.getFullYear()-2; y--) {
    html += '<option value="' + y + '">' + (y+543) + '</option>';
  }
  html += '</select>';
  html += '<select id="rptMonth" class="form-input flex-1 text-xs">';
  var mNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  for (var m = 1; m <= 12; m++) {
    html += '<option value="' + m + '" ' + (m===now.getMonth()+1?'selected':'') + '>' + mNames[m-1] + '</option>';
  }
  html += '</select></div>';
  html += '<button onclick="loadMonthlyReport()" class="btn-success btn-sm"><i class="fi fi-rr-chart-histogram mr-1"></i>ดูรายงาน</button></div>';
  html += '</div>';

  html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 text-sm flex items-center gap-2"><i class="fi fi-rr-triangle-warning text-amber-500"></i> รายการวัสดุที่ต้องเติมสต็อก</h3>';
  html += '<button onclick="exportLowStock()" class="btn-warning btn-sm flex items-center gap-1"><i class="fi fi-rr-file-spreadsheet"></i> Export</button></div>';
  html += '<div class="card-body" id="lowStockReport"><div class="flex justify-center py-4"><div class="w-6 h-6 border-2 border-navy-600 border-t-transparent rounded-full animate-spin"></div></div></div></div>';

  html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';
  html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 text-sm flex items-center gap-2"><i class="fi fi-rr-chart-histogram text-navy-600"></i> ยอดเบิกรายเดือน (6 เดือนล่าสุด)</h3></div>';
  html += '<div class="card-body"><div style="position:relative;height:220px"><canvas id="rptChartMonthly"></canvas></div></div></div>';
  html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 text-sm flex items-center gap-2"><i class="fi fi-rr-star text-amber-500"></i> Top 10 วัสดุที่เบิกมากสุด</h3></div>';
  html += '<div class="card-body" id="rptTopItems"><div class="flex justify-center py-4"><div class="w-6 h-6 border-2 border-navy-600 border-t-transparent rounded-full animate-spin"></div></div></div></div>';
  html += '</div>';

  html += '<div id="reportDataSection"></div></div>';
  document.getElementById('mainContent').innerHTML = html;

  Promise.all([
    callAPI('getDashboardStats', AUTH.token),
    callAPI('getItems', AUTH.token)
  ]).then(function(results) {
    var stats = results[0];
    var items = results[1].data || [];
    var lowItems = items.filter(function(i){ return i.current_stock <= (i.min_stock||5); });

    var lsHtml = '';
    if (lowItems.length === 0) {
      lsHtml = '<p class="text-center text-sm text-gray-400 py-4">ไม่มีรายการวัสดุที่ต้องเติม</p>';
    } else {
      lsHtml = '<div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
      lsHtml += '<tr><th class="px-4 py-2 text-left">รหัส</th><th class="px-4 py-2 text-left">ชื่อวัสดุ</th><th class="px-4 py-2 text-center">คงเหลือ</th><th class="px-4 py-2 text-center">ขั้นต่ำ</th><th class="px-4 py-2 text-center">สถานะ</th></tr>';
      lsHtml += '</thead><tbody class="divide-y divide-gray-100">';
      lowItems.forEach(function(i) {
        var sc = getStockClass(i.current_stock, i.min_stock);
        lsHtml += '<tr><td class="px-4 py-2 font-mono text-xs text-navy-700">' + escHtml(i.item_code) + '</td>';
        lsHtml += '<td class="px-4 py-2 font-medium text-gray-700">' + escHtml(i.name) + '</td>';
        lsHtml += '<td class="px-4 py-2 text-center font-bold">' + i.current_stock + ' ' + escHtml(i.unit) + '</td>';
        lsHtml += '<td class="px-4 py-2 text-center text-gray-400">' + i.min_stock + '</td>';
        lsHtml += '<td class="px-4 py-2 text-center"><span class="px-2 py-0.5 rounded-full text-xs ' + sc + '">' + getStockLabel(i.current_stock, i.min_stock) + '</span></td></tr>';
      });
      lsHtml += '</tbody></table></div>';
    }
    document.getElementById('lowStockReport').innerHTML = lsHtml;

    if (stats.top_items && stats.top_items.length > 0) {
      var tiHtml = '<div class="space-y-2">';
      var maxQ = stats.top_items[0].qty || 1;
      stats.top_items.forEach(function(item, idx) {
        var pct = Math.round(item.qty / maxQ * 100);
        tiHtml += '<div class="flex items-center gap-2">';
        tiHtml += '<span class="text-xs font-bold text-gray-400 w-5 text-right">' + (idx+1) + '</span>';
        tiHtml += '<div class="flex-1"><p class="text-xs font-medium text-gray-700 mb-0.5 truncate">' + escHtml(item.name) + '</p>';
        tiHtml += '<div class="progress-bar"><div class="progress-fill bg-navy-600" style="width:' + pct + '%"></div></div></div>';
        tiHtml += '<span class="text-xs font-bold text-navy-700 w-8 text-right">' + item.qty + '</span></div>';
      });
      tiHtml += '</div>';
      document.getElementById('rptTopItems').innerHTML = tiHtml;
    } else {
      document.getElementById('rptTopItems').innerHTML = '<p class="text-center text-sm text-gray-400 py-4">ยังไม่มีข้อมูลการเบิก</p>';
    }

    if (stats.monthly && document.getElementById('rptChartMonthly')) {
      if (_reportCharts.monthly) _reportCharts.monthly.destroy();
      _reportCharts.monthly = new Chart(document.getElementById('rptChartMonthly'), {
        type:'bar',
        data:{
          labels: stats.monthly.map(function(m){ return m.label; }),
          datasets:[
            { label:'รับเข้า', data:stats.monthly.map(function(m){ return m.receive; }), backgroundColor:'#3b82f6', borderRadius:5, barPercentage:0.6 },
            { label:'เบิกออก', data:stats.monthly.map(function(m){ return m.withdraw; }), backgroundColor:'#8b5cf6', borderRadius:5, barPercentage:0.6 }
          ]
        },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top',labels:{font:{family:'Sarabun',size:11},boxWidth:12}}}, scales:{y:{ticks:{font:{family:'Sarabun',size:11}},grid:{color:'#f3f4f6'}},x:{ticks:{font:{family:'Sarabun',size:11}},grid:{display:false}}} }
      });
    }
  }).catch(function(err) { console.error(err); });
}

function loadReceiveReport() {
  showLoading('โหลดรายงาน...');
  callAPI('getReceives', AUTH.token, {}).then(function(res) {
    hideLoading();
    var data = res.data || [];
    var html = '<div class="card mt-4"><div class="card-header">';
    html += '<h3 class="font-semibold text-gray-700 text-sm">รายงานรับวัสดุเข้าคลัง (' + data.length + ' รายการ)</h3>';
    html += '<button onclick="exportReport(\'receives\')" class="btn-success btn-sm flex items-center gap-1"><i class="fi fi-rr-file-spreadsheet"></i> Export CSV</button></div>';
    html += '<div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
    html += '<tr><th class="px-4 py-2 text-left">เลขที่</th><th class="px-4 py-2 text-left">วันที่</th><th class="px-4 py-2 text-left">รายการ</th><th class="px-4 py-2 text-center">จำนวน</th><th class="px-4 py-2 text-left">ผู้รับ</th><th class="px-4 py-2 text-left">หมายเหตุ</th></tr>';
    html += '</thead><tbody class="divide-y">';
    if (!data.length) html += '<tr><td colspan="6" class="text-center py-8 text-gray-400">ไม่มีรายการ</td></tr>';
    data.slice(0,50).forEach(function(r) {
      html += '<tr><td class="px-4 py-2 font-mono text-xs text-navy-700">' + escHtml(r.receive_no) + '</td>';
      html += '<td class="px-4 py-2 text-xs text-gray-500">' + formatDate(r.date) + '</td>';
      html += '<td class="px-4 py-2 text-gray-700">' + escHtml(r.item_name||'-') + '</td>';
      html += '<td class="px-4 py-2 text-center font-bold text-blue-700">+' + r.quantity + ' ' + escHtml(r.unit||'') + '</td>';
      html += '<td class="px-4 py-2 text-xs text-gray-500">' + escHtml(r.received_by_name||'-') + '</td>';
      html += '<td class="px-4 py-2 text-xs text-gray-400">' + escHtml(r.note||'-') + '</td></tr>';
    });
    if (data.length > 50) html += '<tr><td colspan="6" class="text-center py-3 text-xs text-gray-400">แสดง 50 รายการแรก Export เพื่อดูทั้งหมด</td></tr>';
    html += '</tbody></table></div></div>';
    document.getElementById('reportDataSection').innerHTML = html;
    document.getElementById('reportDataSection').scrollIntoView({ behavior:'smooth' });
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function loadWithdrawReport() {
  showLoading('โหลดรายงาน...');
  callAPI('getWithdrawals', AUTH.token, { status:'all' }).then(function(res) {
    hideLoading();
    var data = res.data || [];
    var html = '<div class="card mt-4"><div class="card-header">';
    html += '<h3 class="font-semibold text-gray-700 text-sm">รายงานเบิกวัสดุออก (' + data.length + ' รายการ)</h3>';
    html += '<button onclick="exportReport(\'withdrawals\')" class="btn-success btn-sm flex items-center gap-1"><i class="fi fi-rr-file-spreadsheet"></i> Export CSV</button></div>';
    html += '<div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
    html += '<tr><th class="px-4 py-2 text-left">เลขที่</th><th class="px-4 py-2 text-left">วันที่</th><th class="px-4 py-2 text-left">รายการ</th><th class="px-4 py-2 text-center">ขอ/อนุมัติ</th><th class="px-4 py-2 text-left">ผู้เบิก</th><th class="px-4 py-2 text-left">วัตถุประสงค์</th><th class="px-4 py-2 text-center">สถานะ</th></tr>';
    html += '</thead><tbody class="divide-y">';
    if (!data.length) html += '<tr><td colspan="7" class="text-center py-8 text-gray-400">ไม่มีรายการ</td></tr>';
    data.slice(0,50).forEach(function(w) {
      var bc = w.status==='approved'?'badge-approved':w.status==='rejected'?'badge-rejected':'badge-pending';
      var sl = {pending:'รออนุมัติ',approved:'อนุมัติ',rejected:'ปฏิเสธ'}[w.status]||w.status;
      html += '<tr><td class="px-4 py-2 font-mono text-xs text-navy-700">' + escHtml(w.withdraw_no) + '</td>';
      html += '<td class="px-4 py-2 text-xs text-gray-500">' + formatDate(w.requested_at) + '</td>';
      html += '<td class="px-4 py-2 text-gray-700">' + escHtml(w.item_name||'-') + '</td>';
      html += '<td class="px-4 py-2 text-center text-xs">' + w.quantity_requested + (w.quantity_approved?'/' + w.quantity_approved:'') + ' ' + escHtml(w.unit||'') + '</td>';
      html += '<td class="px-4 py-2 text-xs text-gray-500">' + escHtml(w.requested_by_name||'-') + '</td>';
      html += '<td class="px-4 py-2 text-xs text-gray-400">' + escHtml(w.purpose||'-') + '</td>';
      html += '<td class="px-4 py-2 text-center"><span class="px-2 py-0.5 rounded-full text-xs ' + bc + '">' + sl + '</span></td></tr>';
    });
    if (data.length > 50) html += '<tr><td colspan="7" class="text-center py-3 text-xs text-gray-400">แสดง 50 รายการแรก Export เพื่อดูทั้งหมด</td></tr>';
    html += '</tbody></table></div></div>';
    document.getElementById('reportDataSection').innerHTML = html;
    document.getElementById('reportDataSection').scrollIntoView({ behavior:'smooth' });
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function loadMonthlyReport() {
  var year  = parseInt((document.getElementById('rptYear')||{}).value||new Date().getFullYear());
  var month = parseInt((document.getElementById('rptMonth')||{}).value||new Date().getMonth()+1);
  showLoading('โหลดรายงานรายเดือน...');
  callAPI('getMonthlyReport', AUTH.token, year, month).then(function(res) {
    hideLoading();
    if (!res.success) { showError(res.message); return; }
    var data = res.data || [];
    var mNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    var daysInMonth = new Date(year, month, 0).getDate();

    var html = '<div class="card mt-4"><div class="card-header">';
    html += '<h3 class="font-semibold text-gray-700 text-sm">สรุปการเบิกวัสดุ ' + mNames[month-1] + ' ' + (year+543) + '</h3>';
    html += '<button onclick="exportMonthlyExcel(' + year + ',' + month + ')" class="btn-success btn-sm flex items-center gap-1"><i class="fi fi-rr-file-spreadsheet"></i> Export CSV</button></div>';
    html += '<div class="overflow-x-auto"><table class="w-full text-xs border-collapse">';
    html += '<thead class="bg-navy-700 text-white sticky top-0">';
    html += '<tr><th class="px-2 py-2 text-left min-w-[160px] border border-navy-600">ชื่อวัสดุ</th>';
    html += '<th class="px-2 py-2 text-center border border-navy-600 w-12">หน่วย</th>';
    html += '<th class="px-2 py-2 text-center border border-navy-600 w-14">รับเข้า</th>';
    for (var d = 1; d <= daysInMonth; d++) {
      html += '<th class="px-1 py-2 text-center border border-navy-600 w-8">' + d + '</th>';
    }
    html += '<th class="px-2 py-2 text-center border border-navy-600 w-14">รวมเบิก</th>';
    html += '<th class="px-2 py-2 text-center border border-navy-600 w-14">คงเหลือ</th></tr></thead>';
    html += '<tbody>';
    if (!data.length) {
      html += '<tr><td colspan="' + (daysInMonth + 5) + '" class="text-center py-6 text-gray-400">ไม่มีข้อมูล</td></tr>';
    }
    data.forEach(function(row, idx) {
      html += '<tr class="' + (idx%2===0?'bg-white':'bg-gray-50') + ' hover:bg-blue-50">';
      html += '<td class="px-2 py-1.5 border border-gray-200 font-medium text-gray-700">' + escHtml(row.name) + (row.size ? ' <span class="text-gray-400">(' + escHtml(row.size) + ')</span>' : '') + '</td>';
      html += '<td class="px-2 py-1.5 border border-gray-200 text-center text-gray-500">' + escHtml(row.unit) + '</td>';
      html += '<td class="px-2 py-1.5 border border-gray-200 text-center font-bold text-blue-700">' + (row.received||0) + '</td>';
      for (var d = 1; d <= daysInMonth; d++) {
        var dayVal = row.daily[d] || 0;
        html += '<td class="px-1 py-1.5 border border-gray-200 text-center ' + (dayVal > 0 ? 'bg-purple-50 font-bold text-purple-700' : 'text-gray-300') + '">' + (dayVal > 0 ? dayVal : '') + '</td>';
      }
      html += '<td class="px-2 py-1.5 border border-gray-200 text-center font-bold text-purple-700">' + (row.total_withdraw||0) + '</td>';
      html += '<td class="px-2 py-1.5 border border-gray-200 text-center font-bold ' + (row.current_stock <= row.min_stock ? 'text-red-600' : 'text-green-700') + '">' + row.current_stock + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<p class="text-xs text-gray-400 px-4 py-2">* ค่าในตารางแสดงจำนวนที่เบิกออกแต่ละวัน</p></div>';
    document.getElementById('reportDataSection').innerHTML = html;
    document.getElementById('reportDataSection').scrollIntoView({ behavior:'smooth' });
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function downloadXlsx(rows, headers, filename) {
  if (!window.XLSX) { showError('ไม่พบ library XLSX'); return; }
  var data = rows.map(function(r) {
    var obj = {};
    headers.forEach(function(h) { obj[h.title] = r[h.key] !== undefined ? r[h.key] : ''; });
    return obj;
  });
  var ws = XLSX.utils.json_to_sheet(data);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename + '.xlsx');
}

function exportReport(type) {
  showLoading('กำลัง Export...');
  var apiFn = type === 'receives' ? 'getReceives' : type === 'withdrawals' ? 'getWithdrawals' : 'getTransactions';
  callAPI(apiFn, AUTH.token, {}).then(function(res) {
    hideLoading();
    if (!res.success) { showError(res.message); return; }
    var data = res.data || [];
    var rows, headers;
    if (type === 'receives') {
      headers = [{key:'receive_no',title:'เลขที่'},{key:'date',title:'วันที่'},{key:'item_name',title:'รายการ'},{key:'quantity',title:'จำนวน'},{key:'created_by_name',title:'ผู้รับ'},{key:'note',title:'หมายเหตุ'}];
      rows = data.map(function(r){ var item=_itemsData.find(function(i){return i.id===r.item_id})||{}; return {receive_no:r.receive_no||'', date:(r.date||'').split('T')[0], item_name:item.name||r.item_id, quantity:r.quantity||0, created_by_name:r.created_by_name||'', note:r.note||''}; });
    } else if (type === 'withdrawals') {
      headers = [{key:'withdraw_no',title:'เลขที่'},{key:'date',title:'วันที่'},{key:'item_name',title:'รายการ'},{key:'quantity',title:'จำนวน'},{key:'requester_name',title:'ผู้เบิก'},{key:'status',title:'สถานะ'},{key:'purpose',title:'วัตถุประสงค์'}];
      rows = data.map(function(w){ var item=_itemsData.find(function(i){return i.id===w.item_id})||{}; return {withdraw_no:w.withdraw_no||'', date:(w.date||'').split('T')[0], item_name:item.name||w.item_id, quantity:w.quantity||0, requester_name:w.requester_name||'', status:w.status==='approved'?'อนุมัติ':w.status==='rejected'?'ปฏิเสธ':'รออนุมัติ', purpose:w.purpose||''}; });
    } else {
      headers = [{key:'type',title:'ประเภท'},{key:'date',title:'วันที่'},{key:'item_name',title:'รายการ'},{key:'quantity',title:'จำนวน'},{key:'user_name',title:'ผู้ทำรายการ'},{key:'note',title:'หมายเหตุ'}];
      rows = data.map(function(t){ var item=_itemsData.find(function(i){return i.id===t.item_id})||{}; return {type:t.type==='receive'?'รับเข้า':'เบิกออก', date:(t.date||'').split('T')[0], item_name:item.name||t.item_id, quantity:t.quantity||0, user_name:t.user_name||'', note:t.note||''}; });
    }
    downloadXlsx(rows, headers, 'รายงาน_' + type);
  }).catch(function() { hideLoading(); showError('Export ไม่สำเร็จ'); });
}

function exportMonthlyExcel(year, month) {
  showLoading('กำลัง Export...');
  callAPI('getMonthlyReport', AUTH.token, year, month).then(function(res) {
    hideLoading();
    if (!res.success) { showError(res.message); return; }
    var data = res.data || [];
    var headers = [{key:'item_name',title:'ชื่อวัสดุ'},{key:'total_requested',title:'จำนวนขอเบิก'},{key:'total_approved',title:'จำนวนอนุมัติ'}];
    var rows = data.map(function(d){ return {item_name:d.item_name||'', total_requested:d.total_requested||0, total_approved:d.total_approved||0}; });
    downloadXlsx(rows, headers, 'รายงานเบิก_' + month + '_' + (year+543));
  }).catch(function() { hideLoading(); showError('Export ไม่สำเร็จ'); });
}

function exportLowStock() {
  showLoading('กำลัง Export...');
  callAPI('getItems', AUTH.token).then(function(res) {
    hideLoading();
    if (!res.success) { showError(res.message); return; }
    var items = (res.data || []).filter(function(i){ return i.active !== false && i.current_stock <= i.min_stock; });
    var headers = [{key:'item_code',title:'รหัส'},{key:'name',title:'ชื่อวัสดุ'},{key:'category',title:'หมวดหมู่'},{key:'current_stock',title:'คงเหลือ'},{key:'min_stock',title:'ขั้นต่ำ'},{key:'unit',title:'หน่วย'}];
    var rows = items.map(function(i){ return {item_code:i.item_code||'', name:i.name||'', category:i.category||'', current_stock:i.current_stock||0, min_stock:i.min_stock||0, unit:i.unit||''}; });
    downloadXlsx(rows, headers, 'รายงานสต็อกต่ำ');
  }).catch(function() { hideLoading(); showError('Export ไม่สำเร็จ'); });
}

// ===== PROFILE =====
function renderProfile() {
  showLoading('โหลดโปรไฟล์...');
  callAPI('getUsers', AUTH.token).then(function(res) {
    hideLoading();
    var users = res.data || [];
    var user  = users.find(function(u){ return u.id === AUTH.user.id; }) || AUTH.user;
    buildProfilePage(user);
  }).catch(function() {
    hideLoading();
    buildProfilePage(AUTH.user);
  });
}

function buildProfilePage(user) {
  var html = '<div class="fade-in w-full space-y-4">';

  html += '<div class="card p-6">';
  html += '<div class="flex items-center gap-5 mb-6">';
  html += '<div class="relative">';
  html += '<div class="w-20 h-20 rounded-2xl bg-navy-100 flex items-center justify-center overflow-hidden shadow">';
  html += '<i class="fi fi-rr-user text-navy-600 text-3xl"></i>';
  html += '</div>';
  html += '<label class="absolute -bottom-1 -right-1 w-6 h-6 bg-navy-700 rounded-lg flex items-center justify-center cursor-pointer hover:bg-navy-800 transition">';
  html += '<i class="fi fi-rr-camera text-white text-xs"></i>';
  html += '<input type="file" accept="image/*" class="hidden" onchange="uploadAvatar(event)"></label></div>';
  html += '<div>';
  html += '<h2 class="text-xl font-bold text-gray-800">' + escHtml(user.name||user.username) + '</h2>';
  html += '<p class="text-sm text-gray-500">@' + escHtml(user.username||'-') + '</p>';
  html += '<span class="mt-1 inline-block px-3 py-0.5 bg-navy-100 text-navy-700 rounded-full text-xs font-semibold">' + (ROLE_LABELS[user.role]||user.role) + '</span>';
  html += '</div></div>';
  html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
  html += '<div><label class="form-label">ชื่อ-นามสกุล</label><input type="text" id="profName" value="' + escHtml(user.name||'') + '" class="form-input"></div>';
  html += '<div><label class="form-label">อีเมล</label><input type="email" id="profEmail" value="' + escHtml(user.email||'') + '" class="form-input"></div>';
  html += '<div><label class="form-label">เบอร์โทรศัพท์</label><input type="text" id="profPhone" value="' + escHtml(user.phone||'') + '" class="form-input"></div>';
  html += '<div><label class="form-label">Telegram Chat ID <span class="text-gray-400 text-xs">(สำหรับรับแจ้งเตือนส่วนตัว)</span></label>';
  html += '<input type="text" id="profTgId" value="' + escHtml(user.telegram_chat_id||'') + '" placeholder="เช่น 123456789" class="form-input"></div>';
  html += '</div>';
  html += '<div class="flex justify-end mt-4">';
  html += '<button onclick="saveProfile(\'' + user.id + '\')" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึกข้อมูล</button></div>';
  html += '</div>';

  html += '<div class="card p-6"><h3 class="font-semibold text-gray-700 mb-4 flex items-center gap-2"><i class="fi fi-rr-lock text-navy-600"></i> เปลี่ยนรหัสผ่าน</h3>';
  html += '<div class="space-y-3">';
  html += passFieldHTML('รหัสผ่านเดิม *', 'profOldPass');
  html += passFieldHTML('รหัสผ่านใหม่ *', 'profNewPass');
  html += passFieldHTML('ยืนยันรหัสผ่านใหม่ *', 'profConfPass');
  html += '</div>';
  html += '<div class="flex justify-end mt-4"><button onclick="doChangePassword()" class="btn-primary"><i class="fi fi-rr-lock mr-1"></i>เปลี่ยนรหัสผ่าน</button></div></div>';

  html += '<div class="card p-4 flex items-center gap-4">';
  html += '<div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center"><i class="fi fi-rr-shield-check text-green-600 text-lg"></i></div>';
  html += '<div><p class="font-semibold text-gray-700 text-sm">สถานะบัญชี</p>';
  html += '<p class="text-xs text-gray-400">บทบาท: ' + (ROLE_LABELS[user.role]||user.role) + ' | เข้าสู่ระบบล่าสุด: ' + formatDateTime(user.last_login||'-') + '</p></div></div>';

  html += '</div>';
  document.getElementById('mainContent').innerHTML = html;
}

function passFieldHTML(label, id) {
  return '<div><label class="form-label">' + escHtml(label) + '</label>'
    + '<div class="relative"><input type="password" id="' + id + '" class="form-input pr-10" placeholder="••••••••">'
    + '<button type="button" onclick="togglePass(\'' + id + '\',this)" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">'
    + '<i class="fi fi-rr-eye text-sm"></i></button></div></div>';
}

function saveProfile(userId) {
  var data = {
    name:  (document.getElementById('profName')||{}).value||'',
    email: (document.getElementById('profEmail')||{}).value||'',
    phone: (document.getElementById('profPhone')||{}).value||'',
    telegram_chat_id: (document.getElementById('profTgId')||{}).value||''
  };
  if (!data.name.trim()) { showError('กรุณากรอกชื่อ'); return; }
  showLoading('กำลังบันทึก...');
  callAPI('updateUser', AUTH.token, userId, data).then(function(res) {
    hideLoading();
    if (res.success) {
      AUTH.user.name = data.name;
      localStorage.setItem('sup_user', JSON.stringify(AUTH.user));
      document.getElementById('sidebarName').textContent = data.name;
      showSuccess(res.message);
    } else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}

function doChangePassword() {
  var oldPass  = (document.getElementById('profOldPass')||{}).value||'';
  var newPass  = (document.getElementById('profNewPass')||{}).value||'';
  var confPass = (document.getElementById('profConfPass')||{}).value||'';
  if (!oldPass || !newPass || !confPass) { showError('กรุณากรอกข้อมูลให้ครบ'); return; }
  if (newPass !== confPass) { showError('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
  if (newPass.length < 6) { showError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
  showLoading('กำลังเปลี่ยนรหัสผ่าน...');
  callAPI('changePassword', AUTH.token, oldPass, newPass).then(function(res) {
    hideLoading();
    if (res.success) {
      showSuccess(res.message);
      ['profOldPass','profNewPass','profConfPass'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
    } else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}

function uploadAvatar(event) {
  var file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showError('ไฟล์ต้องไม่เกิน 2 MB'); return; }
  showLoading('กำลังอัปโหลดรูป...');
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result.split(',')[1];
    callAPI('uploadFile', AUTH.token, base64, file.type, file.name).then(function(res) {
      hideLoading();
      if (res.success) {
        callAPI('updateUser', AUTH.token, AUTH.user.id, { avatar: res.file_id }).then(function() {
          showSuccess('อัปโหลดรูปโปรไฟล์สำเร็จ');
          renderProfile();
        });
      } else showError(res.message);
    }).catch(function() { hideLoading(); showError('อัปโหลดไม่สำเร็จ'); });
  };
  reader.readAsDataURL(file);
}

// ===== USERS =====
var _usersData = [];
var _usersPage = 1;

function renderUsers() {
  if (AUTH.user.role !== 'admin') { loadPage('dashboard'); return; }
  showLoading('โหลดรายชื่อผู้ใช้...');
  callAPI('getUsers', AUTH.token).then(function(res) {
    hideLoading();
    _usersData = res.data || [];
    _usersPage = 1;
    buildUsersPage();
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildUsersPage() {
  var paged = paginate(_usersData, _usersPage);
  var html = '<div class="fade-in space-y-4">';
  html += '<div class="flex items-center justify-between">';
  html += '<h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-users text-navy-600"></i> ผู้ใช้งานทั้งหมด (' + _usersData.length + ')</h3>';
  html += '<button onclick="openAddUserModal()" class="btn-primary flex items-center gap-2"><i class="fi fi-rr-user-add"></i> เพิ่มผู้ใช้</button></div>';

  html += '<div class="card overflow-hidden"><div class="hidden md:block overflow-x-auto">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
  html += '<tr><th class="px-4 py-3 text-left">ชื่อ-นามสกุล</th><th class="px-4 py-3 text-left">Username</th>';
  html += '<th class="px-4 py-3 text-left">บทบาท</th><th class="px-4 py-3 text-left">อีเมล</th>';
  html += '<th class="px-4 py-3 text-left">เข้าสู่ระบบล่าสุด</th><th class="px-4 py-3 text-center">สถานะ</th>';
  html += '<th class="px-4 py-3 text-center">จัดการ</th></tr></thead><tbody class="divide-y divide-gray-100">';
  if (!paged.length) html += '<tr><td colspan="7" class="text-center py-10 text-gray-400">ไม่มีผู้ใช้งาน</td></tr>';
  paged.forEach(function(u) {
    var roleColor = u.role==='admin'?'bg-navy-100 text-navy-700':u.role==='staff'?'bg-blue-100 text-blue-700':'bg-green-100 text-green-700';
    html += '<tr>';
    html += '<td class="px-4 py-2.5"><div class="flex items-center gap-2">';
    html += '<div class="w-8 h-8 rounded-xl bg-navy-100 flex items-center justify-center flex-shrink-0"><i class="fi fi-rr-user text-navy-600 text-sm"></i></div>';
    html += '<span class="font-medium text-gray-700">' + escHtml(u.name||'-') + '</span></div></td>';
    html += '<td class="px-4 py-2.5 font-mono text-xs text-gray-500">' + escHtml(u.username) + '</td>';
    html += '<td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded-full text-xs font-medium ' + roleColor + '">' + (ROLE_LABELS[u.role]||u.role) + '</span></td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-500">' + escHtml(u.email||'-') + '</td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-400">' + formatDateTime(u.last_login) + '</td>';
    html += '<td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-medium ' + (u.active!==false?'bg-green-100 text-green-700':'bg-red-100 text-red-700') + '">' + (u.active!==false?'ใช้งาน':'ระงับ') + '</span></td>';
    html += '<td class="px-4 py-2.5 text-center"><div class="flex gap-1 justify-center">';
    html += '<button onclick="openEditUserModal(\'' + u.id + '\')" title="แก้ไข" class="w-7 h-7 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center hover:bg-blue-200"><i class="fi fi-rr-edit text-xs"></i></button>';
    html += '<button onclick="doResetPassword(\'' + u.id + '\')" title="Reset Password" class="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center hover:bg-amber-200"><i class="fi fi-rr-lock text-xs"></i></button>';
    if (u.id !== AUTH.user.id) {
      html += '<button onclick="doToggleUser(\'' + u.id + '\',\'' + escHtml(u.name||u.username) + '\')" title="' + (u.active!==false?'ระงับ':'เปิด') + 'บัญชี" class="w-7 h-7 ' + (u.active!==false?'bg-red-100 text-red-700 hover:bg-red-200':'bg-green-100 text-green-700 hover:bg-green-200') + ' rounded-lg flex items-center justify-center"><i class="fi fi-rr-' + (u.active!==false?'ban':'check-circle') + ' text-xs"></i></button>';
    }
    html += '</div></td></tr>';
  });
  html += '</tbody></table></div>';

  html += '<div class="md:hidden divide-y">';
  paged.forEach(function(u) {
    var roleColor = u.role==='admin'?'bg-navy-100 text-navy-700':u.role==='staff'?'bg-blue-100 text-blue-700':'bg-green-100 text-green-700';
    html += '<div class="p-4 flex items-center gap-3">';
    html += '<div class="w-10 h-10 rounded-xl bg-navy-100 flex items-center justify-center flex-shrink-0"><i class="fi fi-rr-user text-navy-600"></i></div>';
    html += '<div class="flex-1 min-w-0"><p class="font-semibold text-gray-800 text-sm">' + escHtml(u.name||'-') + '</p>';
    html += '<p class="text-xs text-gray-400">@' + escHtml(u.username) + '</p>';
    html += '<div class="flex gap-1.5 mt-1"><span class="px-2 py-0.5 rounded-full text-xs ' + roleColor + '">' + (ROLE_LABELS[u.role]||u.role) + '</span>';
    html += '<span class="px-2 py-0.5 rounded-full text-xs ' + (u.active!==false?'bg-green-100 text-green-700':'bg-red-100 text-red-700') + '">' + (u.active!==false?'ใช้งาน':'ระงับ') + '</span></div></div>';
    html += '<div class="flex gap-1">';
    html += '<button onclick="openEditUserModal(\'' + u.id + '\')" class="w-8 h-8 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center"><i class="fi fi-rr-edit text-sm"></i></button>';
    html += '<button onclick="doResetPassword(\'' + u.id + '\')" class="w-8 h-8 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center"><i class="fi fi-rr-lock text-sm"></i></button>';
    html += '</div></div>';
  });
  html += '</div></div>';
  html += '<div id="usersPagination"></div></div>';
  document.getElementById('mainContent').innerHTML = html;
  renderPagination('usersPagination', _usersData.length, _usersPage, function(p){ _usersPage=p; buildUsersPage(); });
}

function userFormHTML(user) {
  user = user || {};
  var roleOpts = ['admin','staff','employee'].map(function(r){ return '<option value="' + r + '"' + (user.role===r?' selected':'') + '>' + (ROLE_LABELS[r]||r) + '</option>'; }).join('');
  return '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">'
    + fieldHTML('ชื่อ-นามสกุล *', 'uName', 'text', user.name||'', 'sm:col-span-2')
    + fieldHTML('Username *', 'uUsername', 'text', user.username||'')
    + (!user.id ? '<div><label class="form-label">Password *</label><div class="relative"><input type="password" id="uPassword" class="form-input pr-10" placeholder="รหัสผ่าน"><button type="button" onclick="togglePass(\'uPassword\',this)" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><i class="fi fi-rr-eye text-sm"></i></button></div></div>' : '')
    + fieldHTML('อีเมล', 'uEmail', 'email', user.email||'')
    + fieldHTML('เบอร์โทร', 'uPhone', 'text', user.phone||'')
    + '<div><label class="form-label">บทบาท *</label><select id="uRole" class="form-input">' + roleOpts + '</select></div>'
    + '</div>';
}

function openAddUserModal() {
  var body   = userFormHTML({});
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>'
    + '<button onclick="submitAddUser()" class="btn-primary"><i class="fi fi-rr-user-add mr-1"></i>เพิ่มผู้ใช้</button>';
  openModal('เพิ่มผู้ใช้งานใหม่', body, footer);
}

function openEditUserModal(id) {
  var u = _usersData.find(function(x){ return x.id === id; });
  if (!u) return;
  var body   = userFormHTML(u);
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>'
    + '<button onclick="submitEditUser(\'' + id + '\')" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึก</button>';
  openModal('แก้ไขผู้ใช้งาน: ' + u.name, body, footer);
}

function submitAddUser() {
  var data = { name:(document.getElementById('uName')||{}).value||'', username:(document.getElementById('uUsername')||{}).value||'', password:(document.getElementById('uPassword')||{}).value||'', email:(document.getElementById('uEmail')||{}).value||'', phone:(document.getElementById('uPhone')||{}).value||'', role:(document.getElementById('uRole')||{}).value||'employee' };
  if (!data.name.trim() || !data.username.trim() || !data.password) { showError('กรุณากรอกข้อมูลที่จำเป็น'); return; }
  showLoading('กำลังบันทึก...');
  callAPI('addUser', AUTH.token, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderUsers(); }
    else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}

function submitEditUser(id) {
  var data = { name:(document.getElementById('uName')||{}).value||'', email:(document.getElementById('uEmail')||{}).value||'', phone:(document.getElementById('uPhone')||{}).value||'', role:(document.getElementById('uRole')||{}).value||'employee', active:true };
  if (!data.name.trim()) { showError('กรุณากรอกชื่อ'); return; }
  showLoading('กำลังบันทึก...');
  callAPI('updateUser', AUTH.token, id, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderUsers(); }
    else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}

function doResetPassword(userId) {
  showConfirm('Reset รหัสผ่าน','ระบบจะสร้างรหัสผ่านชั่วคราวใหม่', function() {
    showLoading('กำลัง Reset...');
    callAPI('resetUserPassword', AUTH.token, userId).then(function(res) {
      hideLoading();
      if (res.success) showSuccess(res.message);
      else showError(res.message);
    }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
  }, 'Reset Password');
}

function doToggleUser(userId, name) {
  var user = _usersData.find(function(u){ return u.id===userId; });
  var action = user && user.active!==false ? 'ระงับ' : 'เปิด';
  showConfirm(action + 'บัญชีผู้ใช้', action + 'บัญชีของ "' + name + '" ใช่หรือไม่?', function() {
    showLoading('กำลังดำเนินการ...');
    callAPI('toggleUserActive', AUTH.token, userId).then(function(res) {
      hideLoading();
      if (res.success) { showSuccess(res.message); renderUsers(); }
      else showError(res.message);
    }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
  }, action + 'บัญชี');
}

// ===== SETTINGS =====
var _settingsCats = [], _settingsTypes = [], _settingsAmphoes = [], _settingsFiscalYears = [];

function renderSettings() {
  if (AUTH.user.role !== 'admin') { loadPage('dashboard'); return; }
  showLoading('โหลดการตั้งค่า...');
  Promise.all([
    callAPI('getConfig', AUTH.token),
    callAPI('getAssetCategories', AUTH.token),
    callAPI('getAssetTypes', AUTH.token),
    callAPI('getAmphoes', AUTH.token),
    callAPI('getFiscalYears', AUTH.token)
  ]).then(function(res) {
    hideLoading();
    if (!res[0].success) { showError(res[0].message); return; }
    _settingsCats = res[1].data || [];
    _settingsTypes = res[2].data || [];
    _settingsAmphoes = res[3].data || [];
    _settingsFiscalYears = res[4].data || [];
    buildSettingsPage(res[0].data);
  }).catch(function(){ hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildSettingsPage(cfg) {
  cfg = cfg || {};
  var html = '<div class="fade-in w-full space-y-4">';

  html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-building text-navy-600"></i> ข้อมูลหน่วยงาน</h3></div>';
  html += '<div class="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">';
  html += fieldHTML('ชื่อระบบ', 'cfgAppName', 'text', cfg.app_name||'', 'sm:col-span-2');
  html += fieldHTML('ชื่อหน่วยงาน', 'cfgOrgName', 'text', cfg.organization_name||'', 'sm:col-span-2');
  html += fieldHTML('ที่อยู่', 'cfgOrgAddr', 'text', cfg.organization_address||'', 'sm:col-span-2');
  html += fieldHTML('เบอร์โทรศัพท์', 'cfgOrgPhone', 'text', cfg.organization_phone||'');
  html += fieldHTML('อีเมลหน่วยงาน', 'cfgOrgEmail', 'email', cfg.organization_email||'');
  // Logo upload
  _configLogoFileId = cfg.app_logo || null;
  var logoImgSrc = _configLogoFileId ? imgUrl(_configLogoFileId) : '';
  if (logoImgSrc) {
    html += '<div class="sm:col-span-2"><label class="form-label">โลโก้หน่วยงาน</label><div class="flex items-center gap-3"><img id="cfgLogoPreview" src="' + logoImgSrc + '" class="w-20 h-20 object-contain rounded-xl border border-gray-200 bg-white p-1"><button onclick="removeLogo()" type="button" class="text-red-500 text-sm hover:underline">ลบโลโก้</button></div><input type="hidden" id="cfgLogoFileId" value="' + (_configLogoFileId||'') + '"></div>';
  } else {
    html += '<div class="sm:col-span-2"><label class="form-label">โลโก้หน่วยงาน</label><input type="file" id="cfgLogoFile" accept="image/*" onchange="handleLogoUpload(this)" class="form-input py-1.5"><p class="text-xs text-gray-400 mt-1">รองรับ JPG, PNG (สูงสุด 2MB)</p><div id="cfgLogoPreviewWrap"></div></div>';
  }
  html += '</div></div>';

  html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-bell text-navy-600"></i> การแจ้งเตือน Telegram</h3></div>';
  html += '<div class="card-body space-y-4">';
  html += '<div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">';
  html += '<p class="font-semibold mb-1">วิธีตั้งค่า Telegram Bot (ฟรี)</p>';
  html += '<ol class="list-decimal list-inside space-y-0.5">';
  html += '<li>ทักหา @BotFather บน Telegram แล้วพิมพ์ /newbot</li>';
  html += '<li>ตั้งชื่อ Bot แล้วคัดลอก Token ที่ได้</li>';
  html += '<li>สร้าง Group/Channel แล้วเพิ่ม Bot เข้าไป</li>';
  html += '<li>ส่งข้อความใดก็ได้ใน Group แล้วเปิด URL: api.telegram.org/bot[TOKEN]/getUpdates เพื่อดู chat_id</li>';
  html += '</ol></div>';
  html += '<div class="flex items-center gap-3"><input type="checkbox" id="cfgTgEnabled" ' + (cfg.telegram_enabled?'checked':'') + ' class="w-4 h-4 rounded accent-navy-700">';
  html += '<label for="cfgTgEnabled" class="text-sm font-medium text-gray-700">เปิดใช้งานการแจ้งเตือน Telegram</label></div>';
  html += fieldHTML('Bot Token', 'cfgTgToken', 'text', cfg.telegram_bot_token||'', '');
  html += fieldHTML('Chat ID (Group/Channel)', 'cfgTgChatId', 'text', cfg.telegram_chat_id||'', '');
  html += '<button onclick="doTestTelegram()" class="btn-secondary btn-sm flex items-center gap-1.5 w-fit"><i class="fi fi-rr-paper-plane"></i> ส่ง Test Message</button>';
  html += '</div></div>';

  html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-layers text-navy-600"></i> การตั้งค่าสต็อก</h3></div>';
  html += '<div class="card-body">';
  html += fieldHTML('ระดับสต็อกขั้นต่ำเริ่มต้น', 'cfgLowStock', 'number', cfg.low_stock_threshold||5);
  html += '</div></div>';

  // ===== MASTER DATA: Asset Categories =====
  html += '<div class="card"><div class="card-header flex items-center justify-between"><h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-folder text-navy-600"></i> ประเภทครุภัณฑ์</h3><button onclick="openCatForm()" class="btn-primary btn-sm flex items-center gap-1"><i class="fi fi-rr-plus"></i> เพิ่ม</button></div>';
  html += '<div class="card-body p-0">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600"><tr><th class="px-4 py-2 text-left">ชื่อ</th><th class="px-4 py-2 text-left hidden sm:table-cell">คำอธิบาย</th><th class="px-4 py-2 text-center">Serial</th><th class="px-4 py-2 text-center">ซอฟต์แวร์</th><th class="px-4 py-2 text-center">สถานะ</th><th class="px-4 py-2 text-center w-24">จัดการ</th></tr></thead><tbody class="divide-y divide-gray-100">';
  if (!_settingsCats.length) html += '<tr><td colspan="6" class="text-center py-6 text-gray-400">ไม่มีข้อมูล</td></tr>';
  _settingsCats.forEach(function(c){
    html += '<tr><td class="px-4 py-2 font-medium text-gray-800">' + escHtml(c.name) + '</td>';
    html += '<td class="px-4 py-2 text-gray-500 text-xs hidden sm:table-cell">' + escHtml(c.description||'') + '</td>';
    html += '<td class="px-4 py-2 text-center">' + (c.requires_serial===true?'<span class="text-amber-600 text-xs font-semibold">บังคับ</span>':'<span class="text-gray-300 text-xs">-</span>') + '</td>';
    html += '<td class="px-4 py-2 text-center">' + (c.is_software===true?'<span class="text-blue-600 text-xs font-semibold">ใช่</span>':'<span class="text-gray-300 text-xs">-</span>') + '</td>';
    html += '<td class="px-4 py-2 text-center"><span class="px-2 py-0.5 rounded-full text-xs ' + (c.is_active!==false?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500') + '">' + (c.is_active!==false?'ใช้งาน':'ปิดใช้งาน') + '</span></td>';
    html += '<td class="px-4 py-2 text-center"><div class="flex gap-1 justify-center"><button onclick="openCatForm(' + JSON.stringify(c).replace(/"/g,'&quot;') + ')" class="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center hover:bg-amber-200"><i class="fi fi-rr-edit text-xs"></i></button><button onclick="deleteCatConfirm(\'' + c.id + '\',\'' + escHtml(c.name).replace(/'/g,"\\'") + '\')" class="w-7 h-7 bg-red-100 text-red-700 rounded-lg flex items-center justify-center hover:bg-red-200"><i class="fi fi-rr-trash text-xs"></i></button></div></td></tr>';
  });
  html += '</tbody></table></div></div>';

  // ===== MASTER DATA: Asset Types =====
  html += '<div class="card"><div class="card-header flex items-center justify-between"><h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-box text-navy-600"></i> ชนิดครุภัณฑ์</h3><button onclick="openTypeForm()" class="btn-primary btn-sm flex items-center gap-1"><i class="fi fi-rr-plus"></i> เพิ่ม</button></div>';
  html += '<div class="card-body p-0">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600"><tr><th class="px-4 py-2 text-left">ชื่อ</th><th class="px-4 py-2 text-left hidden sm:table-cell">ประเภท</th><th class="px-4 py-2 text-center">สถานะ</th><th class="px-4 py-2 text-center w-24">จัดการ</th></tr></thead><tbody class="divide-y divide-gray-100">';
  if (!_settingsTypes.length) html += '<tr><td colspan="4" class="text-center py-6 text-gray-400">ไม่มีข้อมูล</td></tr>';
  _settingsTypes.forEach(function(t){
    var cat = _settingsCats.find(function(x){ return x.id === t.category_id; });
    html += '<tr><td class="px-4 py-2 font-medium text-gray-800">' + escHtml(t.name) + '</td>';
    html += '<td class="px-4 py-2 text-gray-500 text-xs hidden sm:table-cell">' + escHtml(cat?cat.name:'-') + '</td>';
    html += '<td class="px-4 py-2 text-center"><span class="px-2 py-0.5 rounded-full text-xs ' + (t.is_active!==false?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500') + '">' + (t.is_active!==false?'ใช้งาน':'ปิดใช้งาน') + '</span></td>';
    html += '<td class="px-4 py-2 text-center"><div class="flex gap-1 justify-center"><button onclick="openTypeForm(' + JSON.stringify(t).replace(/"/g,'&quot;') + ')" class="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center hover:bg-amber-200"><i class="fi fi-rr-edit text-xs"></i></button><button onclick="deleteTypeConfirm(\'' + t.id + '\',\'' + escHtml(t.name).replace(/'/g,"\\'") + '\')" class="w-7 h-7 bg-red-100 text-red-700 rounded-lg flex items-center justify-center hover:bg-red-200"><i class="fi fi-rr-trash text-xs"></i></button></div></td></tr>';
  });
  html += '</tbody></table></div></div>';

  // ===== MASTER DATA: Amphoes =====
  html += '<div class="card"><div class="card-header flex items-center justify-between"><h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-building text-navy-600"></i> หน่วยงาน</h3><button onclick="openAmphoeForm()" class="btn-primary btn-sm flex items-center gap-1"><i class="fi fi-rr-plus"></i> เพิ่ม</button></div>';
  html += '<div class="card-body p-0">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600"><tr><th class="px-4 py-2 text-left">ชื่อ</th><th class="px-4 py-2 text-left hidden sm:table-cell">รหัส</th><th class="px-4 py-2 text-center">สถานะ</th><th class="px-4 py-2 text-center w-24">จัดการ</th></tr></thead><tbody class="divide-y divide-gray-100">';
  if (!_settingsAmphoes.length) html += '<tr><td colspan="4" class="text-center py-6 text-gray-400">ไม่มีข้อมูล</td></tr>';
  _settingsAmphoes.forEach(function(a){
    html += '<tr><td class="px-4 py-2 font-medium text-gray-800">' + escHtml(a.name) + '</td>';
    html += '<td class="px-4 py-2 text-gray-500 text-xs hidden sm:table-cell">' + escHtml(a.code||'') + '</td>';
    html += '<td class="px-4 py-2 text-center"><span class="px-2 py-0.5 rounded-full text-xs ' + (a.is_active!==false?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500') + '">' + (a.is_active!==false?'ใช้งาน':'ปิดใช้งาน') + '</span></td>';
    html += '<td class="px-4 py-2 text-center"><div class="flex gap-1 justify-center"><button onclick="openAmphoeForm(' + JSON.stringify(a).replace(/"/g,'&quot;') + ')" class="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center hover:bg-amber-200"><i class="fi fi-rr-edit text-xs"></i></button><button onclick="deleteAmphoeConfirm(\'' + a.id + '\',\'' + escHtml(a.name).replace(/'/g,"\\'") + '\')" class="w-7 h-7 bg-red-100 text-red-700 rounded-lg flex items-center justify-center hover:bg-red-200"><i class="fi fi-rr-trash text-xs"></i></button></div></td></tr>';
  });
  html += '</tbody></table></div></div>';

  // ===== MASTER DATA: Fiscal Years =====
  html += '<div class="card"><div class="card-header flex items-center justify-between"><h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-calendar text-navy-600"></i> ปีงบประมาณ</h3><button onclick="openFiscalYearForm()" class="btn-primary btn-sm flex items-center gap-1"><i class="fi fi-rr-plus"></i> เพิ่ม</button></div>';
  html += '<div class="card-body p-0">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600"><tr><th class="px-4 py-2 text-left">ปี พ.ศ.</th><th class="px-4 py-2 text-left hidden sm:table-cell">ปี ค.ศ.</th><th class="px-4 py-2 text-center">สถานะ</th><th class="px-4 py-2 text-center w-24">จัดการ</th></tr></thead><tbody class="divide-y divide-gray-100">';
  if (!_settingsFiscalYears.length) html += '<tr><td colspan="4" class="text-center py-6 text-gray-400">ไม่มีข้อมูล</td></tr>';
  _settingsFiscalYears.forEach(function(f){
    html += '<tr><td class="px-4 py-2 font-medium text-gray-800">' + escHtml(f.year||'') + '</td>';
    html += '<td class="px-4 py-2 text-gray-500 text-xs hidden sm:table-cell">' + escHtml(f.year?String(parseInt(f.year)-543):'') + '</td>';
    html += '<td class="px-4 py-2 text-center"><span class="px-2 py-0.5 rounded-full text-xs ' + (f.is_active!==false?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500') + '">' + (f.is_active!==false?'ใช้งาน':'ปิดใช้งาน') + '</span></td>';
    html += '<td class="px-4 py-2 text-center"><div class="flex gap-1 justify-center"><button onclick="openFiscalYearForm(' + JSON.stringify(f).replace(/"/g,'&quot;') + ')" class="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center hover:bg-amber-200"><i class="fi fi-rr-edit text-xs"></i></button><button onclick="deleteFiscalYearConfirm(\'' + f.id + '\',\'' + escHtml(String(f.year||'')).replace(/'/g,"\\'") + '\')" class="w-7 h-7 bg-red-100 text-red-700 rounded-lg flex items-center justify-center hover:bg-red-200"><i class="fi fi-rr-trash text-xs"></i></button></div></td></tr>';
  });
  html += '</tbody></table></div></div>';

  html += '<div class="flex justify-end gap-3">';
  html += '<button onclick="renderSettings()" class="btn-secondary"><i class="fi fi-rr-refresh mr-1"></i>รีเซ็ต</button>';
  html += '<button onclick="saveSettings()" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึกการตั้งค่า</button></div>';

  html += '</div>';
  document.getElementById('mainContent').innerHTML = html;
}

function saveSettings() {
  var data = {
    app_name:              (document.getElementById('cfgAppName')||{}).value||'',
    organization_name:     (document.getElementById('cfgOrgName')||{}).value||'',
    organization_address:  (document.getElementById('cfgOrgAddr')||{}).value||'',
    organization_phone:    (document.getElementById('cfgOrgPhone')||{}).value||'',
    organization_email:    (document.getElementById('cfgOrgEmail')||{}).value||'',
    telegram_enabled:      (document.getElementById('cfgTgEnabled')||{}).checked||false,
    telegram_bot_token:    (document.getElementById('cfgTgToken')||{}).value||'',
    telegram_chat_id:      (document.getElementById('cfgTgChatId')||{}).value||'',
    low_stock_threshold:   parseInt((document.getElementById('cfgLowStock')||{}).value||5),
    app_logo:              (document.getElementById('cfgLogoFileId')||{}).value||_configLogoFileId||''
  };
  showLoading('กำลังบันทึก...');
  callAPI('saveConfig', AUTH.token, data).then(function(res) {
    hideLoading();
    if (res.success) {
      document.getElementById('sidebarAppName').textContent = data.app_name || 'ระบบวัสดุสิ้นเปลือง';
      updateLogoDisplay(data.app_logo);
      showSuccess(res.message);
    } else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function updateLogoDisplay(fileId) {
  var sidebarImg = document.getElementById('sidebarLogoImg');
  var sidebarIcon = document.getElementById('sidebarLogoIcon');
  var loginImg = document.getElementById('loginLogoImg');
  var loginIcon = document.getElementById('loginLogoIcon');
  var loginImgMobile = document.getElementById('loginLogoImgMobile');
  var loginIconMobile = document.getElementById('loginLogoIconMobile');
  var url = fileId ? imgUrl(fileId) : '';
  if (url) {
    if (sidebarImg) { sidebarImg.src = url; sidebarImg.classList.remove('hidden'); }
    if (sidebarIcon) sidebarIcon.classList.add('hidden');
    if (loginImg) { loginImg.src = url; loginImg.classList.remove('hidden'); }
    if (loginIcon) loginIcon.classList.add('hidden');
    if (loginImgMobile) { loginImgMobile.src = url; loginImgMobile.classList.remove('hidden'); }
    if (loginIconMobile) loginIconMobile.classList.add('hidden');
  } else {
    if (sidebarImg) sidebarImg.classList.add('hidden');
    if (sidebarIcon) sidebarIcon.classList.remove('hidden');
    if (loginImg) loginImg.classList.add('hidden');
    if (loginIcon) loginIcon.classList.remove('hidden');
    if (loginImgMobile) loginImgMobile.classList.add('hidden');
    if (loginIconMobile) loginIconMobile.classList.remove('hidden');
  }
}
function handleLogoUpload(input) {
  var file = input.files[0];
  if (!file) return;
  if (!file.type.match('image.*')) { showError('กรุณาเลือกไฟล์รูปภาพ'); input.value=''; return; }
  if (file.size > 2 * 1024 * 1024) { showError('ไฟล์ต้องไม่เกิน 2MB'); input.value=''; return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result.split(',')[1];
    showLoading('กำลังอัปโหลดโลโก้...');
    callAPI('uploadFile', AUTH.token, base64, file.type, file.name).then(function(res) {
      hideLoading();
      if (res.success) {
        _configLogoFileId = res.file_id;
        var wrap = document.getElementById('cfgLogoPreviewWrap');
        var url = imgUrl(res.file_id);
        if (wrap) wrap.innerHTML = '<div class="flex items-center gap-3 mt-2"><img src="' + url + '" class="w-20 h-20 object-contain rounded-xl border border-gray-200 bg-white p-1"><button onclick="removeLogo()" type="button" class="text-red-500 text-sm hover:underline">ลบโลโก้</button></div><input type="hidden" id="cfgLogoFileId" value="' + res.file_id + '">';
      } else showError(res.message);
    }).catch(function() { hideLoading(); showError('อัปโหลดไม่สำเร็จ'); });
  };
  reader.readAsDataURL(file);
}
function removeLogo() {
  _configLogoFileId = null;
  renderSettings();
}

function doTestTelegram() {
  showLoading('กำลังส่ง Test Message...');
  callAPI('testTelegram', AUTH.token).then(function(res) {
    hideLoading();
    if (res.success) showSuccess(res.message);
    else showError(res.message);
  }).catch(function() { hideLoading(); showError('เกิดข้อผิดพลาด'); });
}

// ===== QR SCANNER =====
var _qrScanner = null;
function renderQRScanner() {
  var html = '<div class="fade-in space-y-4">';
  html += '<div class="card p-6 text-center">';
  html += '<h3 class="font-semibold text-gray-700 mb-4"><i class="fi fi-rr-qr-scan text-navy-600 mr-2"></i>สแกน QR Code เพื่อเบิกวัสดุ</h3>';
  html += '<div id="qr-reader"></div>';
  html += '<p class="text-xs text-gray-400 mt-3">อนุญาตให้ใช้กล้องเพื่อสแกน QR Code ได้เลย</p>';
  html += '<button onclick="stopQRScanner()" class="btn-secondary btn-sm mt-4"><i class="fi fi-rr-cross mr-1"></i>ปิดกล้อง</button>';
  html += '</div></div>';
  document.getElementById('mainContent').innerHTML = html;

  setTimeout(function() {
    try {
      _qrScanner = new Html5Qrcode('qr-reader');
      _qrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        function(decodedText) {
          stopQRScanner();
          try {
            var url = new URL(decodedText);
            var action = url.searchParams.get('action');
            var itemId = url.searchParams.get('item_id');
            var assetId = url.searchParams.get('id');
            if (action === 'withdraw' && itemId) {
              openWithdrawFromQR(itemId);
            } else if (action === 'asset' && assetId) {
              _loadAssetRefs(function() {
                callAPI('getAssets', AUTH.token).then(function(res) {
                  _assetData = res.data || [];
                  openAssetDetail(assetId);
                });
              });
            } else {
              showError('QR Code ไม่ถูกต้อง');
            }
          } catch(e) {
            showError('QR Code ไม่ถูกต้อง');
          }
        },
        function(errorMessage) {}
      ).catch(function(err) {
        console.error(err);
        showError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์');
      });
    } catch(e) {
      console.error(e);
      showError('เบราว์เซอร์นี้ไม่รองรับการใช้งานกล้อง');
    }
  }, 300);
}

function stopQRScanner() {
  if (_qrScanner) {
    _qrScanner.stop().then(function() { _qrScanner = null; }).catch(function() { _qrScanner = null; });
  }
}

// ===== ASSET SYSTEM =====
var _assetData = [];
var _assetPage = 1;
var _assetFilter = { search:'', category:'all', amphoe:'all', status:'all' };
var _assetCats = [];
var _assetTypes = [];
var _amphoes = [];
var _assetImageFileId = null;

function _assetStatusLabel(st) {
  var map = { active:'ใช้งานได้', damaged:'ชำรุด/รอจำหน่าย', disposed:'จำหน่ายแล้ว', pending_dispose:'รออนุมัติจำหน่าย' };
  return map[st] || st;
}
function _assetStatusClass(st) {
  var map = { active:'bg-green-100 text-green-700', damaged:'bg-amber-100 text-amber-700', disposed:'bg-red-100 text-red-700', pending_dispose:'bg-orange-100 text-orange-700' };
  return map[st] || 'bg-gray-100 text-gray-700';
}
function _getAssetCatName(id) { var c = _assetCats.find(function(x){ return x.id === id; }); return c ? c.name : '-'; }
function _getAssetTypeName(id) { var t = _assetTypes.find(function(x){ return x.id === id; }); return t ? t.name : '-'; }
function _getAmphoeName(id) { var a = _amphoes.find(function(x){ return x.id === id; }); return a ? a.name : '-'; }
function _fmtMoney(n) { return Number(n||0).toLocaleString('th-TH', {maximumFractionDigits:0}) + ' บ.'; }

var _assetFiscalYears = [];
function _loadAssetRefs(cb) {
  Promise.all([
    callAPI('getAssetCategories', AUTH.token),
    callAPI('getAssetTypes', AUTH.token),
    callAPI('getAmphoes', AUTH.token),
    callAPI('getFiscalYears', AUTH.token)
  ]).then(function(res) {
    _assetCats = res[0].data || [];
    _assetTypes = res[1].data || [];
    _amphoes = res[2].data || [];
    _assetFiscalYears = res[3].data || [];
    if (cb) cb();
  });
}

function renderAssets() {
  if (!AUTH.hasRole(['admin','staff'])) { loadPage('dashboard'); return; }
  showLoading('โหลดทะเบียนครุภัณฑ์...');
  Promise.all([
    callAPI('getAssets', AUTH.token),
    callAPI('getAssetCategories', AUTH.token),
    callAPI('getAssetTypes', AUTH.token),
    callAPI('getAmphoes', AUTH.token),
    callAPI('getFiscalYears', AUTH.token)
  ]).then(function(res) {
    hideLoading();
    _assetData = res[0].data || [];
    _assetCats = res[1].data || [];
    _assetTypes = res[2].data || [];
    _amphoes = res[3].data || [];
    _assetFiscalYears = res[4].data || [];
    _assetPage = 1;
    buildAssetsPage();
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildAssetsPage() {
  var filtered = _assetData.filter(function(a) {
    if (_assetFilter.category !== 'all' && a.category_id !== _assetFilter.category) return false;
    if (_assetFilter.amphoe !== 'all' && a.amphoe_id !== _assetFilter.amphoe) return false;
    if (_assetFilter.status !== 'all' && a.status !== _assetFilter.status) return false;
    if (_assetFilter.search) {
      var t = _assetFilter.search.toLowerCase();
      return (a.description||'').toLowerCase().includes(t) || (a.asset_code||'').toLowerCase().includes(t) || (a.asset_number||'').toLowerCase().includes(t);
    }
    return true;
  });
  var paged = paginate(filtered, _assetPage);
  var isAdmin = AUTH.user.role === 'admin';

  var html = '<div class="fade-in space-y-4">';
  html += '<div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">';
  html += '<div class="flex flex-wrap gap-2 flex-1">';
  html += '<input type="text" id="assetSearch" placeholder="ค้นหาครุภัณฑ์..." value="' + escHtml(_assetFilter.search) + '" onkeyup="_assetDebounceSearch()" class="form-input flex-1 min-w-[200px]">';
  html += '<select id="assetFilterCat" onchange="_assetSetFilter()" class="form-input">';
  html += '<option value="all">ทุกประเภท</option>';
  _assetCats.forEach(function(c){ html += '<option value="' + c.id + '"' + (_assetFilter.category===c.id?' selected':'') + '>' + escHtml(c.name) + '</option>'; });
  html += '</select>';
  html += '<select id="assetFilterAmp" onchange="_assetSetFilter()" class="form-input">';
  html += '<option value="all">ทุกหน่วยงาน</option>';
  _amphoes.forEach(function(a){ html += '<option value="' + a.id + '"' + (_assetFilter.amphoe===a.id?' selected':'') + '>' + escHtml(a.name) + '</option>'; });
  html += '</select>';
  html += '<select id="assetFilterStatus" onchange="_assetSetFilter()" class="form-input">';
  html += '<option value="all">ทุกสถานะ</option>';
  html += '<option value="active"' + (_assetFilter.status==='active'?' selected':'') + '>ใช้งานได้</option>';
  html += '<option value="damaged"' + (_assetFilter.status==='damaged'?' selected':'') + '>ชำรุด/รอจำหน่าย</option>';
  html += '<option value="disposed"' + (_assetFilter.status==='disposed'?' selected':'') + '>จำหน่ายแล้ว</option>';
  html += '</select>';
  html += '</div>';
  if (isAdmin) html += '<button onclick="openAssetForm()" class="btn-primary flex items-center gap-2 whitespace-nowrap"><i class="fi fi-rr-plus"></i> เพิ่มครุภัณฑ์</button>';
  html += '</div>';

  html += '<div class="card overflow-hidden"><div class="hidden md:block overflow-x-auto">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
  html += '<tr><th class="px-4 py-3 text-left">รหัส/รายการ</th><th class="px-4 py-3 text-left hidden lg:table-cell">ประเภท</th><th class="px-4 py-3 text-left hidden lg:table-cell">หน่วยงาน</th><th class="px-4 py-3 text-right">ราคา</th><th class="px-4 py-3 text-center">สถานะ</th><th class="px-4 py-3 text-center w-32">จัดการ</th></tr></thead>';
  html += '<tbody class="divide-y divide-gray-100">';
  if (!paged.length) html += '<tr><td colspan="6" class="text-center py-10 text-gray-400">ไม่พบข้อมูล</td></tr>';
  paged.forEach(function(a) {
    html += '<tr>';
    html += '<td class="px-4 py-2.5"><div class="flex items-center gap-3">';
    var img = a.image_url ? imgUrl(a.image_url) : '';
    if (img) html += '<img src="' + img + '" class="w-10 h-10 object-cover rounded-lg border border-gray-200">';
    else html += '<div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><i class="fi fi-rr-box text-gray-400 text-sm"></i></div>';
    html += '<div><p class="font-medium text-gray-800 text-sm">' + escHtml(a.description) + '</p><p class="text-xs text-gray-500">' + escHtml(a.asset_code||'-') + ' • ' + escHtml(a.asset_number||'-') + '</p></div></div></td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-600 hidden lg:table-cell">' + escHtml(_getAssetCatName(a.category_id)) + '</td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-600 hidden lg:table-cell">' + escHtml(_getAmphoeName(a.amphoe_id)) + '</td>';
    html += '<td class="px-4 py-2.5 text-right text-sm font-medium text-gray-800">' + _fmtMoney(a.unit_price) + '</td>';
    html += '<td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-medium ' + _assetStatusClass(a.status) + '">' + _assetStatusLabel(a.status) + '</span></td>';
    html += '<td class="px-4 py-2.5 text-center"><div class="flex gap-1 justify-center">';
    html += '<button onclick="window.open(\'?public_asset_id=' + a.id + '\', \'_blank\')" title="ดูรายละเอียด" class="w-7 h-7 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center hover:bg-gray-200"><i class="fi fi-rr-eye text-xs"></i></button>';
    html += '<button onclick="printAssetQR(\'' + a.id + '\')" title="พิมพ์ QR" class="w-7 h-7 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center hover:bg-blue-200"><i class="fi fi-rr-print text-xs"></i></button>';
    if (isAdmin) {
      html += '<button onclick="openAssetForm(\'' + a.id + '\')" title="แก้ไข" class="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center hover:bg-amber-200"><i class="fi fi-rr-edit text-xs"></i></button>';
      html += '<button onclick="deleteAssetConfirm(\'' + a.id + '\', \'' + escHtml(a.description).replace(/'/g, "\\'") + '\')" title="ลบ" class="w-7 h-7 bg-red-100 text-red-700 rounded-lg flex items-center justify-center hover:bg-red-200"><i class="fi fi-rr-trash text-xs"></i></button>';
    }
    html += '</div></td></tr>';
  });
  html += '</tbody></table></div>';

  // Mobile cards
  html += '<div class="md:hidden divide-y">';
  paged.forEach(function(a) {
    html += '<div class="p-4 flex items-center gap-3">';
    var img = a.image_url ? imgUrl(a.image_url) : '';
    if (img) html += '<img src="' + img + '" class="w-12 h-12 object-cover rounded-lg border border-gray-200">';
    else html += '<div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center"><i class="fi fi-rr-box text-gray-400"></i></div>';
    html += '<div class="flex-1 min-w-0"><p class="font-semibold text-gray-800 text-sm">' + escHtml(a.description) + '</p>';
    html += '<p class="text-xs text-gray-500">' + escHtml(a.asset_code||'') + '</p>';
    html += '<div class="flex gap-1.5 mt-1"><span class="px-2 py-0.5 rounded-full text-xs ' + _assetStatusClass(a.status) + '">' + _assetStatusLabel(a.status) + '</span>';
    html += '<span class="text-xs text-gray-500">' + _fmtMoney(a.unit_price) + '</span></div></div>';
    html += '<div class="flex gap-1">';
    html += '<button onclick="window.open(\'?public_asset_id=' + a.id + '\', \'_blank\')" class="w-8 h-8 bg-gray-100 text-gray-600 rounded-xl flex items-center justify-center"><i class="fi fi-rr-eye text-sm"></i></button>';
    if (isAdmin) html += '<button onclick="openAssetForm(\'' + a.id + '\')" class="w-8 h-8 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center"><i class="fi fi-rr-edit text-sm"></i></button>';
    html += '</div></div>';
  });
  html += '</div></div>';
  html += '<div id="assetPagination"></div></div>';
  document.getElementById('mainContent').innerHTML = html;
  renderPagination('assetPagination', filtered.length, _assetPage, function(p){ _assetPage=p; buildAssetsPage(); });
}

var _assetSearchTimer;
function _assetDebounceSearch() {
  clearTimeout(_assetSearchTimer);
  _assetSearchTimer = setTimeout(_assetSetFilter, 300);
}
function _assetSetFilter() {
  _assetFilter.search = (document.getElementById('assetSearch')||{}).value||'';
  _assetFilter.category = (document.getElementById('assetFilterCat')||{}).value||'all';
  _assetFilter.amphoe = (document.getElementById('assetFilterAmp')||{}).value||'all';
  _assetFilter.status = (document.getElementById('assetFilterStatus')||{}).value||'all';
  _assetPage = 1;
  buildAssetsPage();
}

function openAssetDetail(id) {
  var a = _assetData.find(function(x){ return x.id === id; });
  if (!a) return;
  var html = '<div class="space-y-4">';
  html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">';
  html += _detailRow('รหัสครุภัณฑ์', a.asset_code||'-');
  html += _detailRow('เลขทะเบียน', a.asset_number||'-');
  html += _detailRow('ประเภท', _getAssetCatName(a.category_id));
  html += _detailRow('ชนิด', _getAssetTypeName(a.type_id));
  html += _detailRow('ยี่ห้อ/รุ่น', a.brand_model||'-');
  html += _detailRow('หมายเลขเครื่อง', a.serial_number||'-');
  html += _detailRow('ราคา', _fmtMoney(a.unit_price));
  html += _detailRow('วิธีการได้มา', a.acquisition_method||'-');
  html += _detailRow('วันที่ได้รับ', formatDate(a.receive_date));
  html += _detailRow('เลข GFMIS', a.gfmis_number||'-');
  html += _detailRow('หน่วยงาน', _getAmphoeName(a.amphoe_id));
  html += _detailRow('สถานที่ติดตั้ง', a.location||'-');
  html += _detailRow('สถานะ', '<span class="px-2 py-0.5 rounded-full text-xs font-medium ' + _assetStatusClass(a.status) + '">' + _assetStatusLabel(a.status) + '</span>');
  html += _detailRow('ปีงบประมาณ', a.fiscal_year||'-');
  html += _detailRow('หมายเหตุ', a.notes||'-');
  html += '</div>';
  if (a.image_url) {
    var img = imgUrl(a.image_url);
    html += '<div class="text-center"><img src="' + img + '" class="max-h-48 rounded-xl border border-gray-200 mx-auto"></div>';
  }
  html += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ปิด</button>';
  if (AUTH.user.role === 'admin') footer += '<button onclick="closeModal();openAssetForm(\'' + a.id + '\')" class="btn-primary"><i class="fi fi-rr-edit mr-1"></i>แก้ไข</button>';
  openModal('รายละเอียดครุภัณฑ์', html, footer);
}
function _detailRow(label, value) {
  return '<div><p class="text-xs text-gray-500 mb-0.5">' + escHtml(label) + '</p><p class="font-medium text-gray-800">' + value + '</p></div>';
}

function openAssetForm(id) {
  if (AUTH.user.role !== 'admin') return;
  var a = id ? _assetData.find(function(x){ return x.id === id; }) : null;
  _assetImageFileId = a ? (a.image_url||null) : null;
  var body = '<div class="space-y-3">';
  body += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
  body += '<div><label class="form-label">รหัสครุภัณฑ์ *</label><input type="text" id="aAssetCode" value="' + escHtml(a?a.asset_code:'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">เลขทะเบียน</label><input type="text" id="aAssetNumber" value="' + escHtml(a?a.asset_number:'') + '" class="form-input"></div>';
  body += '</div>';
  body += '<div><label class="form-label">รายการ/คำอธิบาย *</label><input type="text" id="aDesc" value="' + escHtml(a?a.description:'') + '" class="form-input"></div>';
  body += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
  body += '<div><label class="form-label">ประเภทครุภัณฑ์</label><select id="aCategory" class="form-input" onchange="_onAssetCategoryChange()">';
  body += '<option value="">เลือกประเภท</option>';
  _assetCats.forEach(function(c){ body += '<option value="' + c.id + '"' + ((a&&a.category_id===c.id)?' selected':'') + '>' + escHtml(c.name) + '</option>'; });
  body += '</select></div>';
  body += '<div><label class="form-label">ชนิดครุภัณฑ์</label><select id="aType" class="form-input"><option value="">เลือกชนิด</option></select></div>';
  body += '</div>';
  body += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
  body += '<div><label class="form-label">ยี่ห้อ/รุ่น/ขนาด</label><input type="text" id="aBrand" value="' + escHtml(a?a.brand_model:'') + '" class="form-input"></div>';
  body += '<div><label class="form-label" id="aSerialLabel">หมายเลขเครื่อง</label><input type="text" id="aSerial" value="' + escHtml(a?a.serial_number:'') + '" class="form-input"></div>';
  body += '</div>';
  body += '<div id="aInstalledWrap" class="hidden">';
  body += '<div><label class="form-label">ติดตั้งอยู่ที่ครุภัณฑ์</label><select id="aInstalledAsset" class="form-input">';
  body += '<option value="">เลือกครุภัณฑ์</option>';
  _assetData.forEach(function(asset){
    var cat = _assetCats.find(function(x){ return x.id === asset.category_id; });
    if (cat && cat.is_software !== true && cat.requires_serial === true) {
      body += '<option value="' + asset.id + '"' + ((a&&a.installed_asset_id===asset.id)?' selected':'') + '>' + escHtml(asset.asset_code||'') + ' - ' + escHtml(asset.description||'') + '</option>';
    }
  });
  body += '</select></div>';
  body += '</div>';
  body += '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">';
  body += '<div><label class="form-label">วันที่ได้รับ</label><input type="date" id="aReceiveDate" value="' + escHtml(a?a.receive_date:'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">เลข GFMIS</label><input type="text" id="aGfmis" value="' + escHtml(a?a.gfmis_number:'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">ราคา (บาท)</label><input type="number" id="aPrice" value="' + (a?a.unit_price:'') + '" class="form-input"></div>';
  body += '</div>';
  body += '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">';
  body += '<div><label class="form-label">วิธีการได้มา</label><input type="text" id="aMethod" value="' + escHtml(a?a.acquisition_method:'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">หน่วยงาน</label><select id="aAmphoe" class="form-input">';
  body += '<option value="">เลือกหน่วยงาน</option>';
  _amphoes.forEach(function(am){ body += '<option value="' + am.id + '"' + ((a&&a.amphoe_id===am.id)?' selected':'') + '>' + escHtml(am.name) + '</option>'; });
  body += '</select></div>';
  body += '<div><label class="form-label">ปีงบประมาณ</label><select id="aFiscal" class="form-input">';
  var currentFy = a ? String(a.fiscal_year||'') : '';
  var defaultFy = currentFy || String(new Date().getFullYear() + 543);
  var fyList = _assetFiscalYears.length ? _assetFiscalYears.map(function(f){ return f.year; }) : [defaultFy];
  fyList.forEach(function(y){
    if (!y) return;
    body += '<option value="' + y + '"' + (defaultFy===y?' selected':'') + '>' + y + '</option>';
  });
  body += '</select></div>';
  body += '</div>';
  body += '<div><label class="form-label">สถานที่ติดตั้ง/จัดเก็บ</label><input type="text" id="aLocation" value="' + escHtml(a?a.location:'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">สถานะ</label><select id="aStatus" class="form-input">';
  body += '<option value="active"' + ((a&&a.status==='active')?' selected':'') + '>ใช้งานได้</option>';
  body += '<option value="damaged"' + ((a&&a.status==='damaged')?' selected':'') + '>ชำรุด/รอจำหน่าย</option>';
  body += '<option value="disposed"' + ((a&&a.status==='disposed')?' selected':'') + '>จำหน่ายแล้ว</option>';
  body += '<option value="pending_dispose"' + ((a&&a.status==='pending_dispose')?' selected':'') + '>รออนุมัติจำหน่าย</option>';
  body += '</select></div>';
  body += '<div><label class="form-label">รูปภาพ</label><input type="file" id="aImage" accept="image/*" onchange="_uploadAssetImage(this)" class="form-input py-1.5">';
  if (_assetImageFileId) {
    body += '<div class="mt-2"><img src="' + imgUrl(_assetImageFileId) + '" class="h-24 rounded-xl border border-gray-200" loading="lazy"></div>';
  }
  body += '</div>';
  body += '<div><label class="form-label">หมายเหตุ</label><textarea id="aNotes" class="form-input" rows="2">' + escHtml(a?a.notes:'') + '</textarea></div>';
  body += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>';
  if (id) footer += '<button onclick="submitEditAsset(\'' + id + '\')" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึก</button>';
  else footer += '<button onclick="submitAddAsset()" class="btn-primary"><i class="fi fi-rr-plus mr-1"></i>เพิ่ม</button>';
  openModal(a ? 'แก้ไขครุภัณฑ์' : 'เพิ่มครุภัณฑ์', body, footer);
  setTimeout(function(){ _loadAssetTypes(); }, 50);
}

function _loadAssetTypes() {
  var catId = (document.getElementById('aCategory')||{}).value||'';
  var sel = document.getElementById('aType');
  if (!sel) return;
  var current = sel.value;
  var html = '<option value="">เลือกชนิด</option>';
  _assetTypes.filter(function(t){ return t.category_id === catId; }).forEach(function(t){
    html += '<option value="' + t.id + '"' + (current===t.id?' selected':'') + '>' + escHtml(t.name) + '</option>';
  });
  sel.innerHTML = html;
}

function _onAssetCategoryChange() {
  _loadAssetTypes();
  var catId = (document.getElementById('aCategory')||{}).value||'';
  var cat = _assetCats.find(function(c){ return c.id === catId; });
  var serialLabel = document.getElementById('aSerialLabel');
  var installedWrap = document.getElementById('aInstalledWrap');
  if (serialLabel) serialLabel.textContent = (cat && cat.requires_serial===true) ? 'หมายเลขเครื่อง/Serial/License *' : 'หมายเลขเครื่อง';
  if (installedWrap) installedWrap.classList.toggle('hidden', !(cat && cat.is_software===true));
}

function _uploadAssetImage(input) {
  var file = input.files[0];
  if (!file) return;
  if (file.size > 2*1024*1024) { showError('ไฟล์ต้องไม่เกิน 2MB'); return; }
  showLoading('กำลังอัปโหลด...');
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result.split(',')[1];
    callAPI('uploadFile', AUTH.token, base64, file.type, file.name).then(function(res) {
      hideLoading();
      if (res.success) {
        _assetImageFileId = res.file_id;
        showSuccess('อัปโหลดรูปเรียบร้อย');
      } else showError(res.message);
    }).catch(function(){ hideLoading(); showError('อัปโหลดไม่สำเร็จ'); });
  };
  reader.readAsDataURL(file);
}

function _readAssetForm() {
  var installedAssetEl = document.getElementById('aInstalledAsset');
  return {
    asset_code: (document.getElementById('aAssetCode')||{}).value||'',
    asset_number: (document.getElementById('aAssetNumber')||{}).value||'',
    description: (document.getElementById('aDesc')||{}).value||'',
    category_id: (document.getElementById('aCategory')||{}).value||'',
    type_id: (document.getElementById('aType')||{}).value||'',
    brand_model: (document.getElementById('aBrand')||{}).value||'',
    serial_number: (document.getElementById('aSerial')||{}).value||'',
    receive_date: (document.getElementById('aReceiveDate')||{}).value||'',
    gfmis_number: (document.getElementById('aGfmis')||{}).value||'',
    unit_price: parseFloat((document.getElementById('aPrice')||{}).value||0),
    acquisition_method: (document.getElementById('aMethod')||{}).value||'',
    amphoe_id: (document.getElementById('aAmphoe')||{}).value||'',
    location: (document.getElementById('aLocation')||{}).value||'',
    status: (document.getElementById('aStatus')||{}).value||'active',
    fiscal_year: parseInt((document.getElementById('aFiscal')||{}).value||0),
    notes: (document.getElementById('aNotes')||{}).value||'',
    image_url: _assetImageFileId || '',
    installed_asset_id: installedAssetEl ? (installedAssetEl.value||'') : ''
  };
}

function _validateAssetForm(data) {
  if (!data.asset_code.trim() || !data.description.trim()) { showError('กรุณากรอกรหัสครุภัณฑ์และรายการ'); return false; }
  var cat = _assetCats.find(function(c){ return c.id === data.category_id; });
  if (cat && cat.requires_serial===true && !data.serial_number.trim()) { showError('ประเภทนี้ต้องกรอกหมายเลขเครื่อง/Serial/License'); return false; }
  if (cat && cat.is_software===true && !data.installed_asset_id.trim()) { showError('ซอฟต์แวร์ต้องเลือกครุภัณฑ์ที่ติดตั้ง'); return false; }
  return true;
}

function submitAddAsset() {
  var data = _readAssetForm();
  if (!_validateAssetForm(data)) return;
  showLoading('กำลังบันทึก...');
  callAPI('saveAsset', AUTH.token, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderAssets(); }
    else showError(res.message);
  }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function submitEditAsset(id) {
  var data = _readAssetForm();
  if (!_validateAssetForm(data)) return;
  data.id = id;
  showLoading('กำลังบันทึก...');
  callAPI('saveAsset', AUTH.token, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderAssets(); }
    else showError(res.message);
  }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function deleteAssetConfirm(id, name) {
  showConfirm('ลบครุภัณฑ์', 'ต้องการลบ "' + name + '" ใช่หรือไม่?', function() {
    showLoading('กำลังลบ...');
    callAPI('deleteAsset', AUTH.token, id).then(function(res) {
      hideLoading();
      if (res.success) { showSuccess(res.message); renderAssets(); }
      else showError(res.message);
    }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
  }, 'ลบ');
}
function printAssetQR(id) {
  var a = _assetData.find(function(x){ return x.id === id; });
  if (!a) return;
  var baseUrl = window.location.origin + window.location.pathname;
  var qrUrl = baseUrl + '?public_asset_id=' + id;
  var body = '<div class="text-center">';
  body += '<p class="font-semibold text-gray-700 mb-1">' + escHtml(a.description) + '</p>';
  body += '<p class="text-xs text-gray-500 mb-3">' + escHtml(a.asset_code||'') + '</p>';
  body += '<div id="assetQrWrap" class="inline-block p-3 bg-white rounded-xl border border-gray-200"></div>';
  body += '</div>';
  openModal('QR Code ครุภัณฑ์', body, '<button onclick="closeModal()" class="btn-secondary">ปิด</button>');
  setTimeout(function() {
    new QRCode(document.getElementById('assetQrWrap'), { text: qrUrl, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.H });
  }, 100);
}

// ===== PUBLIC ASSET DETAIL (NO LOGIN) =====
function renderPublicAssetPage() {
  var _s = function(id,prop,val){ var el=document.getElementById(id); if(el) el.style[prop]=val; };
  var el = document.getElementById('loginPage'); if(el) el.classList.add('hidden');
  var ms = document.getElementById('mainShell'); if(ms) ms.classList.remove('hidden');
  _s('sidebar','display','none');
  _s('topbar','display','none');
  var mc = document.getElementById('mainContent');
  if (mc) { mc.classList.remove('lg:ml-64'); mc.style.cssText += ';margin-left:0 !important'; }

  showLoading('กำลังโหลดข้อมูล...');
  Promise.all([
    callAPI('getPublicAssetDetail', _PUBLIC_ASSET_ID),
    callAPI('getConfig')
  ]).then(function(results) {
    hideLoading();
    var detailRes = results[0];
    var cfg = results[1].data || {};

    if (!detailRes.success || !detailRes.data) {
      document.getElementById('mainContent').innerHTML = '<div class="p-8 text-center text-gray-500">ไม่พบข้อมูลครุภัณฑ์</div>';
      return;
    }
    var d = detailRes.data;
    var a = d.asset;
    var cats = d.categories || [];
    var types = d.types || [];
    var amphoes = d.amphoes || [];
    var assetMaint = d.maintenance || [];
    var cat = cats.find(function(c){ return c.id === a.category_id; });
    var type = types.find(function(t){ return t.id === a.type_id; });
    var amphoe = amphoes.find(function(am){ return am.id === a.amphoe_id; });

    var usefulLife = type && type.useful_life ? parseInt(type.useful_life) : 0;
    var depRate = type && type.depreciation_rate ? parseFloat(type.depreciation_rate) : 0;
    var price = parseFloat(a.unit_price || 0);
    var annualDep = depRate > 0 ? price * (depRate / 100) : (usefulLife > 0 ? price / usefulLife : 0);
    var monthlyDep = annualDep / 12;

    // Compute depreciation schedule
    var schedule = [];
    var bookValue = price;
    for (var y = 1; y <= usefulLife; y++) {
      var dep = annualDep;
      if (y === usefulLife) dep = bookValue - 1; // salvage value ~1 Baht
      if (dep > bookValue) dep = bookValue;
      bookValue -= dep;
      if (bookValue < 0) { dep += bookValue; bookValue = 0; }
      schedule.push({ year: y, depreciation: dep, accumulated: price - bookValue, bookValue: bookValue });
    }

    var html = '<div class="fade-in max-w-3xl mx-auto p-4 pb-16">';
    // Header
    html += '<div class="flex items-start gap-4 mb-6">';
    var qrUrl = window.location.origin + window.location.pathname + '?public_asset_id=' + a.id;
    html += '<div id="publicQr" class="flex-shrink-0"></div>';
    html += '<div class="flex-1 min-w-0">';
    html += '<p class="text-xs text-gray-500">' + escHtml(cat ? cat.name : '-') + ' / ' + escHtml(type ? type.name : '-') + '</p>';
    html += '<h2 class="text-lg font-bold text-gray-800 leading-tight">' + escHtml(a.description) + '</h2>';
    html += '<p class="text-sm text-gray-600 mt-1">' + escHtml(a.brand_model||'') + '</p>';
    html += '<div class="flex items-center gap-2 mt-2"><span class="px-2 py-0.5 rounded-full text-xs font-medium ' + _assetStatusClass(a.status) + '">' + _assetStatusLabel(a.status) + '</span></div>';
    html += '</div></div>';

    // Code badge
    html += '<div class="bg-white rounded-xl border border-gray-200 p-4 mb-4">';
    html += '<div class="flex items-center justify-between"><div><p class="text-xs text-gray-500">รหัสครุภัณฑ์</p><p class="text-sm font-semibold text-navy-700">' + escHtml(a.asset_code||'-') + '</p></div>';
    html += '<button onclick="printAssetRegister(\'' + a.id + '\')" class="btn-primary btn-sm"><i class="fi fi-rr-print mr-1"></i>ทะเบียนคุมฯ</button></div>';
    html += '</div>';

    // Info sections
    html += '<div class="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">';
    html += '<div class="px-4 py-3 border-b bg-gray-50 flex items-center gap-2"><i class="fi fi-rr-info text-navy-600 text-sm"></i><span class="text-sm font-semibold text-gray-700">ข้อมูลทั่วไป</span></div>';
    html += '<div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">';
    html += _detailRow('วันที่ได้รับ', formatDate(a.receive_date));
    html += _detailRow('เลขที่ GFMIS', a.gfmis_number||'-');
    html += _detailRow('Serial / License', a.serial_number||'-');
    html += _detailRow('สถานที่ตั้ง', a.location||'-');
    html += _detailRow('ติดตั้งที่ครุภัณฑ์', a.installed_location||'-');
    html += _detailRow('หน่วยงาน', amphoe ? amphoe.name : '-');
    html += _detailRow('ปีงบประมาณ', a.fiscal_year||'-');
    html += _detailRow('วิธีการได้มา', a.acquisition_method||'-');
    html += '</div></div>';

    // Responsible person / owner
    html += '<div class="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">';
    html += '<div class="px-4 py-3 border-b bg-gray-50 flex items-center gap-2"><i class="fi fi-rr-user text-navy-600 text-sm"></i><span class="text-sm font-semibold text-gray-700">ผู้ครอบครอง / ผู้รับผิดชอบ</span></div>';
    html += '<div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">';
    html += _detailRow('ผู้ใช้งาน / ผู้ครอบครอง', a.responsible_person || '-');
    html += _detailRow('ตำแหน่ง / สถานที่ใช้งาน', a.installed_location || a.location || '-');
    html += _detailRow('หน่วยงาน', amphoe ? amphoe.name : '-');
    html += _detailRow('หมายเหตุ', a.notes || '-');
    html += '</div></div>';

    // Vendor
    html += '<div class="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">';
    html += '<div class="px-4 py-3 border-b bg-gray-50 flex items-center gap-2"><i class="fi fi-rr-building text-navy-600 text-sm"></i><span class="text-sm font-semibold text-gray-700">ข้อมูลผู้มอบ / ผู้ขาย</span></div>';
    html += '<div class="p-4 text-sm"><p class="font-medium text-gray-800">' + escHtml(a.vendor_name || a.supplier_name || '-') + '</p><p class="text-xs text-gray-500 mt-1">' + escHtml(a.vendor_address||'') + '</p></div>';
    html += '</div>';

    // Depreciation summary
    html += '<div class="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">';
    html += '<div class="px-4 py-3 border-b bg-gray-50 flex items-center gap-2"><i class="fi fi-rr-chart-pie-alt text-navy-600 text-sm"></i><span class="text-sm font-semibold text-gray-700">ข้อมูลการเสื่อมราคา</span></div>';
    html += '<div class="p-4">';
    html += '<div class="grid grid-cols-3 gap-3 text-center">';
    html += '<div class="bg-gray-50 rounded-lg p-3"><p class="text-xs text-gray-500">ราคา</p><p class="text-sm font-bold text-gray-800">' + _fmtMoney(price) + '</p></div>';
    html += '<div class="bg-red-50 rounded-lg p-3"><p class="text-xs text-gray-500">ค่าเสื่อม/เดือน</p><p class="text-sm font-bold text-red-600">' + _fmtMoney(monthlyDep) + '</p></div>';
    html += '<div class="bg-green-50 rounded-lg p-3"><p class="text-xs text-gray-500">มูลค่าสุทธิ</p><p class="text-sm font-bold text-green-600">' + _fmtMoney(schedule.length ? schedule[schedule.length-1].bookValue : price) + '</p></div>';
    html += '</div>';
    // Schedule table
    if (schedule.length) {
      html += '<div class="mt-4 overflow-x-auto">';
      html += '<table class="w-full text-xs"><thead class="bg-gray-50 text-gray-600"><tr><th class="px-2 py-2 text-left">ปีที่</th><th class="px-2 py-2 text-right">ค่าเสื่อมปี (บ)</th><th class="px-2 py-2 text-right">ค่าเสื่อมสะสม (บ)</th><th class="px-2 py-2 text-right">มูลค่าสุทธิ (บ)</th></tr></thead><tbody class="divide-y">';
      schedule.forEach(function(row){
        html += '<tr><td class="px-2 py-2">' + row.year + '</td><td class="px-2 py-2 text-right">' + Number(row.depreciation).toLocaleString('th-TH',{maximumFractionDigits:2}) + '</td><td class="px-2 py-2 text-right">' + Number(row.accumulated).toLocaleString('th-TH',{maximumFractionDigits:2}) + '</td><td class="px-2 py-2 text-right">' + Number(row.bookValue).toLocaleString('th-TH',{maximumFractionDigits:2}) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div></div>';

    // Maintenance history
    html += '<div class="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">';
    html += '<div class="px-4 py-3 border-b bg-gray-50 flex items-center gap-2"><i class="fi fi-rr-wrench text-navy-600 text-sm"></i><span class="text-sm font-semibold text-gray-700">ประวัติการซ่อมบำรุง</span></div>';
    if (assetMaint.length) {
      html += '<div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-gray-50 text-gray-600"><tr><th class="px-3 py-2 text-left">วันที่</th><th class="px-3 py-2 text-left">รายการ</th><th class="px-3 py-2 text-right">ค่าใช้จ่าย</th></tr></thead><tbody class="divide-y">';
      assetMaint.forEach(function(m){
        html += '<tr><td class="px-3 py-2">' + formatDate(m.maintenance_date) + '</td><td class="px-3 py-2">' + escHtml(m.description||'-') + '</td><td class="px-3 py-2 text-right">' + _fmtMoney(m.cost||0) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div class="p-6 text-center text-gray-400 text-sm"><i class="fi fi-rr-shield-check text-2xl mb-2 block"></i>ยังไม่มีประวัติการซ่อมบำรุง</div>';
    }
    html += '</div>';

    html += '</div>';
    document.getElementById('mainContent').innerHTML = html;
    setTimeout(function() {
      new QRCode(document.getElementById('publicQr'), { text: qrUrl, width: 100, height: 100, correctLevel: QRCode.CorrectLevel.H });
    }, 100);
  }).catch(function(err) {
    hideLoading();
    document.getElementById('mainContent').innerHTML = '<div class="p-8 text-center text-gray-500">โหลดข้อมูลไม่สำเร็จ</div>';
  });
}

function printAssetRegister(id) {
  var baseUrl = window.location.origin + window.location.pathname;
  showLoading('กำลังเตรียมข้อมูล...');
  Promise.all([
    callAPI('getPublicAssetDetail', id),
    callAPI('getConfig')
  ]).then(function(results) {
    hideLoading();
    var detailRes = results[0];
    var cfg = results[1].data || {};
    if (!detailRes.success || !detailRes.data) { showError('ไม่พบข้อมูล'); return; }
    var d = detailRes.data;
    var a = d.asset;
    var cats = d.categories || [];
    var types = d.types || [];
    var amphoes = d.amphoes || [];
    var cat = cats.find(function(c){ return c.id === a.category_id; });
    var type = types.find(function(t){ return t.id === a.type_id; });
    var amphoe = amphoes.find(function(am){ return am.id === a.amphoe_id; });
    var orgName = cfg.app_name || cfg.organization_name || 'ระบบวัสดุสิ้นเปลือง';
    var amphoeShort = amphoe ? amphoe.name : '';
    var logoUrl = cfg.app_logo ? imgUrl(cfg.app_logo) : '';

    var usefulLife = type && type.useful_life ? parseInt(type.useful_life) : 0;
    var depRate = type && type.depreciation_rate ? parseFloat(type.depreciation_rate) : 0;
    var price = parseFloat(a.unit_price || 0);
    var annualDep = depRate > 0 ? price * (depRate / 100) : (usefulLife > 0 ? price / usefulLife : 0);

    var schedule = [];
    var bookValue = price;
    for (var y = 1; y <= usefulLife; y++) {
      var dep = annualDep;
      if (y === usefulLife) dep = bookValue - 1;
      if (dep > bookValue) dep = bookValue;
      bookValue -= dep;
      if (bookValue < 0) { dep += bookValue; bookValue = 0; }
      schedule.push({ year: y, depreciation: dep, accumulated: price - bookValue, bookValue: bookValue });
    }

    var qrUrl = baseUrl + '?public_asset_id=' + id;
    try {
      var qrDiv = document.createElement('div');
      qrDiv.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
      document.body.appendChild(qrDiv);
      new QRCode(qrDiv, { text: qrUrl, width: 140, height: 140, correctLevel: QRCode.CorrectLevel.H });
      setTimeout(function(){
        var qrDataUrl = '';
        var canvas = qrDiv.querySelector('canvas');
        var img = qrDiv.querySelector('img');
        if (canvas && canvas.toDataURL) qrDataUrl = canvas.toDataURL('image/png');
        else if (img && img.src) qrDataUrl = img.src;
        document.body.removeChild(qrDiv);
        _openRegisterModal(a, cat, type, amphoe, orgName, logoUrl, schedule, usefulLife, depRate, price, annualDep, qrDataUrl, qrUrl);
      }, 350);
    } catch(e) {
      _openRegisterModal(a, cat, type, amphoe, orgName, logoUrl, schedule, usefulLife, depRate, price, annualDep, '', qrUrl);
    }
  }).catch(function() {
    hideLoading();
    showError('โหลดข้อมูลไม่สำเร็จ');
  });
}

function _openRegisterModal(a, cat, type, amphoe, orgName, logoUrl, schedule, usefulLife, depRate, price, annualDep, qrDataUrl, qrUrl) {
  var inner = _buildRegisterHTML(a, cat, type, amphoe, orgName, logoUrl, schedule, usefulLife, depRate, price, qrDataUrl);

  // Store for actual print
  window._lastRegisterPrintHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ทะเบียนคุมสินทรัพย์รายตัว</title>' +
    '<style>' +
    '@page{size:A4 landscape;margin:0}' +
    'html{margin:0;padding:0}' +
    'body{font-family:sarabun,sans-serif;margin:0;padding:0;background:#fff;color:#000;font-size:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '*{box-sizing:border-box;word-break:break-word;overflow-wrap:break-word}' +
    '.print-wrap{padding:14mm 16mm;width:100%;max-width:100%}' +
    '.print-wrap div[style*="display:flex"]{display:flex !important}' +
    'table{border-collapse:collapse;width:100%;table-layout:fixed}' +
    'th,td{border:1px solid #999;padding:2px 3px;font-size:9px;word-break:break-word;overflow-wrap:break-word;vertical-align:top;overflow:hidden}' +
    'th{background:#f3f4f6 !important;text-align:center;font-weight:600}' +
    'img{max-width:100%;height:auto}' +
    '@media print{.no-print{display:none}}' +
    '</style>' +
    '</head><body><div class="print-wrap">' + inner + '</div></body></html>';

  // Build custom wide overlay
  var overlay = document.createElement('div');
  overlay.id = 'regModalOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow-y:auto;';
  overlay.onclick = function(e){ if(e.target===overlay) _closeRegisterModal(); };

  var box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);width:100%;max-width:900px;display:flex;flex-direction:column;font-family:sarabun,sans-serif;';

  // Header
  var hdr = '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">';
  hdr += '<div style="display:flex;align-items:center;gap:8px;"><span style="color:#16a34a;font-size:16px;">&#128196;</span><span style="font-weight:700;font-size:15px;color:#1f2937;">ทะเบียนคุมสินทรัพย์รายตัว</span></div>';
  hdr += '<div style="display:flex;align-items:center;gap:8px;">';
  hdr += '<button onclick="_doPrintRegister()" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;"><span>&#128424;</span> พิมพ์</button>';
  hdr += '<button onclick="_closeRegisterModal()" style="display:inline-flex;align-items:center;gap:4px;padding:8px 14px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:13px;cursor:pointer;">&#10005; ปิด</button>';
  hdr += '</div></div>';

  // Body with scrollable content
  var bdy = '<div style="padding:24px;overflow-y:auto;max-height:calc(90vh - 80px);">' + inner + '</div>';

  box.innerHTML = hdr + bdy;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function _buildRegisterHTML(a, cat, type, amphoe, orgName, logoUrl, schedule, usefulLife, depRate, price, qrDataUrl) {
  var F = function(n){ return Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var TDSTYLE = 'border:1px solid #999;padding:5px 7px;vertical-align:top;word-break:break-word;';
  var td = function(label, value, colspan) {
    return '<td' + (colspan ? ' colspan="'+colspan+'"' : '') + ' style="' + TDSTYLE + '">'
      + '<div style="font-size:9px;color:#666;margin-bottom:2px;">' + label + '</div>'
      + '<div style="font-weight:600;font-size:11px;">' + escHtml(String(value||'-')) + '</div>'
      + '</td>';
  };

  var html = '';

  // ── Header: flex 3-column — org | title | QR ──
  html += '<div style="display:flex;align-items:center;width:100%;margin-bottom:14px;gap:0;">';
  // Left: org (flex: 1)
  html += '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;">';
  if (logoUrl) html += '<img src="' + logoUrl + '" style="width:44px;height:44px;object-fit:contain;flex-shrink:0;">';
  html += '<div style="min-width:0;">';
  html += '<div style="font-weight:700;font-size:13px;line-height:1.4;">' + escHtml(orgName) + '</div>';
  html += '<div style="font-size:11px;color:#555;">' + escHtml(amphoe ? amphoe.name : '') + '</div>';
  html += '</div></div>';
  // Center: title (flex: 0 auto — takes exactly what it needs, centered via margin)
  html += '<div style="flex:1;text-align:center;">';
  html += '<div style="font-size:18px;font-weight:700;white-space:nowrap;">ทะเบียนคุมสินทรัพย์รายตัว</div>';
  html += '</div>';
  // Right: QR (flex: 1, right-align)
  html += '<div style="flex:1;display:flex;justify-content:flex-end;align-items:center;">';
  if (qrDataUrl) {
    html += '<div style="text-align:center;">';
    html += '<img src="' + qrDataUrl + '" style="width:80px;height:80px;display:block;">';
    html += '<div style="font-size:9px;color:#888;margin-top:2px;">สแกนดูรายละเอียด</div>';
    html += '</div>';
  }
  html += '</div>';
  html += '</div>';

  // ── Info table: 5 columns, 3 rows ──
  // Row 1: 5 cells
  // Row 2: 4 cells → last one colspan=2 to fill 5
  // Row 3: วิธีได้มา | ผู้ขาย(colspan=2) | หมายเหตุ(colspan=2)
  html += '<table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:4px;"><colgroup>';
  html += '<col style="width:22%"><col style="width:16%"><col style="width:18%"><col style="width:22%"><col style="width:22%">';
  html += '</colgroup><tbody>';

  // Row 1
  html += '<tr>';
  html += td('ประเภทครุภัณฑ์', (cat?cat.name:'') + (type?' / '+type.name:''));
  html += td('รหัสสินทรัพย์', a.asset_code);
  html += td('หมายเลข S/N', a.serial_number);
  html += td('เลขที่ GFMIS', a.gfmis_number);
  html += td('เลขทะเบียน', a.asset_number);
  html += '</tr>';

  // Row 2: ลักษณะ/ชื่อ/รุ่น | สถานภาพ | เครื่องประจำตำแหน่ง(colspan=2) | หน่วยงาน
  html += '<tr>';
  html += td('ลักษณะ/ชื่อ/รุ่น', a.description + (a.brand_model ? ' '+a.brand_model : ''));
  html += td('สถานภาพ', a.status === 'active' ? 'กำลังใช้งาน' : a.status === 'damaged' ? 'ชำรุด' : 'จำหน่ายแล้ว');
  html += td('เครื่องประจำตำแหน่ง', a.installed_location || (amphoe ? 'ส่วนราชการ '+amphoe.name : '-'), 2);
  html += td('หน่วยงาน', amphoe ? amphoe.name : '-');
  html += '</tr>';

  // Row 3: วิธีได้มา | ผู้ขาย/ผู้บริจาค(colspan=2) | หมายเหตุ(colspan=2)
  html += '<tr>';
  html += td('วิธีการได้มา', a.acquisition_method);
  html += td('ผู้ขาย/ผู้บริจาค', a.supplier_name || '-', 2);
  html += td('หมายเหตุ', a.notes || '-', 2);
  html += '</tr>';

  html += '</tbody></table>';

  // ── Depreciation table ──
  html += '<div style="font-size:12px;font-weight:700;margin:14px 0 6px;">ตารางค่าเสื่อมราคา</div>';
  var THSTYLE = 'border:1px solid #999;padding:4px 3px;background:#f3f4f6;text-align:center;font-weight:600;white-space:pre-line;font-size:9px;';
  var TDNUM = 'border:1px solid #999;padding:3px 4px;font-size:10px;';
  html += '<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px;"><colgroup>';
  // 13 columns widths (%)
  [4,8,6,14,6,8,8,5,6,8,8,8,5].forEach(function(w){ html += '<col style="width:'+w+'%">'; });
  html += '</colgroup><thead><tr>';
  ['ลำดับ','วัน/เดือน/ปี\n(รับเข้า)','ปีงบ\nประมาณ','รายการ','จำนวน\n(หน่วย)','ราคาต่อ\nหน่วย','มูลค่า\nรวม','อายุใช้\nงาน(ปี)','อัตรา\nค่าเสื่อม%','ค่าเสื่อม\nประจำปี','ค่าเสื่อม\nสะสม','มูลค่า\nสุทธิ','หมาย\nเหตุ'].forEach(function(h){
    html += '<th style="' + THSTYLE + '">' + h + '</th>';
  });
  html += '</tr></thead><tbody>';
  if (schedule.length) {
    schedule.forEach(function(row, i) {
      var bg = i%2===1 ? 'background:#f9fafb;' : '';
      html += '<tr style="' + bg + '">';
      html += '<td style="' + TDNUM + 'text-align:center;">' + (i+1) + '</td>';
      html += '<td style="' + TDNUM + 'text-align:center;">' + escHtml(formatDate(a.receive_date)||'-') + '</td>';
      html += '<td style="' + TDNUM + 'text-align:center;">' + escHtml(String(a.fiscal_year||'-')) + '</td>';
      html += '<td style="' + TDNUM + 'word-break:break-word;">' + escHtml(a.description||'') + '</td>';
      html += '<td style="' + TDNUM + 'text-align:center;">1</td>';
      html += '<td style="' + TDNUM + 'text-align:right;">' + F(price) + '</td>';
      html += '<td style="' + TDNUM + 'text-align:right;">' + F(price) + '</td>';
      html += '<td style="' + TDNUM + 'text-align:center;">' + usefulLife + '</td>';
      html += '<td style="' + TDNUM + 'text-align:center;">' + (depRate ? depRate.toFixed(2)+'%' : '-') + '</td>';
      html += '<td style="' + TDNUM + 'text-align:right;">' + F(row.depreciation) + '</td>';
      html += '<td style="' + TDNUM + 'text-align:right;">' + F(row.accumulated) + '</td>';
      html += '<td style="' + TDNUM + 'text-align:right;">' + F(row.bookValue) + '</td>';
      html += '<td style="' + TDNUM + '"></td>';
      html += '</tr>';
    });
  } else {
    html += '<tr><td colspan="13" style="' + TDNUM + 'text-align:center;color:#999;padding:8px;">ไม่มีข้อมูลค่าเสื่อมราคา</td></tr>';
  }
  html += '</tbody></table>';

  // ── Signatures ──
  html += '<div style="margin-top:40px;display:flex;justify-content:space-around;font-size:11px;">';
  ['ผู้ตรวจสอบ','ผู้รับผิดชอบสินทรัพย์','เจ้าหน้าที่พัสดุ'].forEach(function(sig){
    html += '<div style="text-align:center;min-width:140px;">';
    html += '<div style="height:44px;"></div>';
    html += '<div style="border-top:1px solid #333;padding-top:6px;">(................................)</div>';
    html += '<div style="font-weight:600;margin-top:4px;">' + sig + '</div>';
    html += '<div style="color:#777;margin-top:4px;">วันที่ ....../....../......</div>';
    html += '</div>';
  });
  html += '</div>';

  html += '<div style="text-align:center;font-size:9px;color:#aaa;margin-top:16px;">' + escHtml(orgName) + '</div>';
  return html;
}

function _closeRegisterModal() {
  var el = document.getElementById('regModalOverlay');
  if (el) el.remove();
}

function _doPrintRegister() {
  if (!window._lastRegisterPrintHTML) return;
  var win = window.open('', '_blank');
  win.document.write(window._lastRegisterPrintHTML);
  win.document.close();
  setTimeout(function(){ win.print(); }, 400);
}

function renderAssetStatus() {
  if (AUTH.user.role === 'employee') { loadPage('dashboard'); return; }
  showLoading('โหลดข้อมูล...');
  Promise.all([
    callAPI('getAssets', AUTH.token),
    callAPI('getAssetStatusLogs', AUTH.token)
  ]).then(function(res) {
    hideLoading();
    _assetData = res[0].data || [];
    var logs = res[1].data || [];
    buildAssetStatusPage(logs);
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildAssetStatusPage(logs) {
  var html = '<div class="fade-in space-y-4">';
  html += '<h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-tag text-navy-600"></i> อัปเดตสถานภาพครุภัณฑ์</h3>';
  html += '<div class="card overflow-hidden"><div class="overflow-x-auto">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
  html += '<tr><th class="px-4 py-3 text-left">รายการ</th><th class="px-4 py-3 text-left">รหัส</th><th class="px-4 py-3 text-center">สถานะปัจจุบัน</th><th class="px-4 py-3 text-left">หน่วยงาน</th><th class="px-4 py-3 text-center w-40">จัดการ</th></tr></thead>';
  html += '<tbody class="divide-y divide-gray-100">';
  if (!_assetData.length) html += '<tr><td colspan="5" class="text-center py-10 text-gray-400">ไม่พบข้อมูล</td></tr>';
  _assetData.forEach(function(a) {
    html += '<tr>';
    html += '<td class="px-4 py-2.5 font-medium text-gray-800 text-sm">' + escHtml(a.description) + '</td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-500">' + escHtml(a.asset_code||'-') + '</td>';
    html += '<td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-medium ' + _assetStatusClass(a.status) + '">' + _assetStatusLabel(a.status) + '</span></td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-600">' + escHtml(_getAmphoeName(a.amphoe_id)) + '</td>';
    html += '<td class="px-4 py-2.5 text-center">';
    html += '<button onclick="openChangeStatusModal(\'' + a.id + '\')" class="btn-primary btn-sm"><i class="fi fi-rr-exchange mr-1"></i>เปลี่ยนสถานะ</button>';
    html += '</td></tr>';
  });
  html += '</tbody></table></div></div>';

  // Recent status logs
  html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 text-sm flex items-center gap-2"><i class="fi fi-rr-time-past text-navy-600"></i> ประวัติการเปลี่ยนสถานะล่าสุด</h3></div>';
  html += '<div class="card-body"><div class="overflow-x-auto">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
  html += '<tr><th class="px-4 py-2 text-left">วันที่</th><th class="px-4 py-2 text-left">รายการ</th><th class="px-4 py-2 text-center">จาก</th><th class="px-4 py-2 text-center">เป็น</th><th class="px-4 py-2 text-left">หมายเหตุ</th></tr></thead>';
  html += '<tbody class="divide-y divide-gray-100">';
  var recentLogs = (logs || []).slice().sort(function(a,b){ return new Date(b.created_at)-new Date(a.created_at); }).slice(0, 20);
  if (!recentLogs.length) html += '<tr><td colspan="5" class="text-center py-6 text-gray-400">ไม่มีประวัติ</td></tr>';
  recentLogs.forEach(function(l) {
    var asset = _assetData.find(function(x){ return x.id === l.asset_id; });
    html += '<tr><td class="px-4 py-2 text-xs text-gray-500">' + formatDateTime(l.created_at) + '</td>';
    html += '<td class="px-4 py-2 text-sm text-gray-800">' + escHtml(asset ? asset.description : '-') + '</td>';
    html += '<td class="px-4 py-2 text-center"><span class="px-1.5 py-0.5 rounded text-xs ' + _assetStatusClass(l.old_status) + '">' + _assetStatusLabel(l.old_status) + '</span></td>';
    html += '<td class="px-4 py-2 text-center"><span class="px-1.5 py-0.5 rounded text-xs ' + _assetStatusClass(l.new_status) + '">' + _assetStatusLabel(l.new_status) + '</span></td>';
    html += '<td class="px-4 py-2 text-xs text-gray-500">' + escHtml(l.notes||'') + '</td></tr>';
  });
  html += '</tbody></table></div></div></div>';
  html += '</div>';
  document.getElementById('mainContent').innerHTML = html;
}

function openChangeStatusModal(assetId) {
  var a = _assetData.find(function(x){ return x.id === assetId; });
  if (!a) return;
  var body = '<div class="space-y-3">';
  body += '<p class="text-sm text-gray-600">รายการ: <b>' + escHtml(a.description) + '</b></p>';
  body += '<p class="text-xs text-gray-500">สถานะปัจจุบัน: <span class="px-2 py-0.5 rounded-full text-xs font-medium ' + _assetStatusClass(a.status) + '">' + _assetStatusLabel(a.status) + '</span></p>';
  body += '<div><label class="form-label">เปลี่ยนสถานะเป็น</label><select id="chgStatus" class="form-input">';
  body += '<option value="active">ใช้งานได้</option>';
  body += '<option value="damaged">ชำรุด/รอจำหน่าย</option>';
  body += '<option value="disposed">จำหน่ายแล้ว</option>';
  body += '<option value="pending_dispose">รออนุมัติจำหน่าย</option>';
  body += '</select></div>';
  body += '<div><label class="form-label">หมายเหตุ</label><textarea id="chgStatusNote" class="form-input" rows="2"></textarea></div>';
  body += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>';
  footer += '<button onclick="submitChangeStatus(\'' + assetId + '\')" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึก</button>';
  openModal('เปลี่ยนสถานะครุภัณฑ์', body, footer);
}

function submitChangeStatus(assetId) {
  var newStatus = (document.getElementById('chgStatus')||{}).value||'';
  var note = (document.getElementById('chgStatusNote')||{}).value||'';
  var a = _assetData.find(function(x){ return x.id === assetId; });
  if (!a) return;
  showLoading('กำลังบันทึก...');
  callAPI('saveAssetStatusLog', AUTH.token, { asset_id: assetId, old_status: a.status, new_status: newStatus, notes: note }).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderAssetStatus(); }
    else showError(res.message);
  }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
}

function renderAssetMaintenance() {
  if (AUTH.user.role === 'employee') { loadPage('dashboard'); return; }
  showLoading('โหลดข้อมูล...');
  Promise.all([
    callAPI('getAssets', AUTH.token),
    callAPI('getAssetMaintenance', AUTH.token)
  ]).then(function(res) {
    hideLoading();
    _assetData = res[0].data || [];
    var records = res[1].data || [];
    buildAssetMaintenancePage(records);
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildAssetMaintenancePage(records) {
  var html = '<div class="fade-in space-y-4">';
  html += '<div class="flex items-center justify-between">';
  html += '<h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-wrench text-navy-600"></i> ประวัติซ่อมบำรุงครุภัณฑ์</h3>';
  if (AUTH.user.role !== 'employee') html += '<button onclick="openMaintenanceForm()" class="btn-primary flex items-center gap-2"><i class="fi fi-rr-plus"></i> เพิ่มรายการ</button>';
  html += '</div>';
  html += '<div class="card overflow-hidden"><div class="overflow-x-auto">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
  html += '<tr><th class="px-4 py-3 text-left">วันที่</th><th class="px-4 py-3 text-left">รายการครุภัณฑ์</th><th class="px-4 py-3 text-left">รายละเอียดการซ่อม</th><th class="px-4 py-3 text-left">ผู้รับเหมา</th><th class="px-4 py-3 text-right">ค่าใช้จ่าย</th><th class="px-4 py-3 text-center w-24">จัดการ</th></tr></thead>';
  html += '<tbody class="divide-y divide-gray-100">';
  var sorted = records.slice().sort(function(a,b){ return new Date(b.maintenance_date)-new Date(a.maintenance_date); });
  if (!sorted.length) html += '<tr><td colspan="6" class="text-center py-10 text-gray-400">ไม่พบข้อมูล</td></tr>';
  sorted.forEach(function(r) {
    var asset = _assetData.find(function(x){ return x.id === r.asset_id; });
    html += '<tr><td class="px-4 py-2.5 text-xs text-gray-500">' + formatDate(r.maintenance_date) + '</td>';
    html += '<td class="px-4 py-2.5 font-medium text-gray-800 text-sm">' + escHtml(asset ? asset.description : '-') + '</td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-600">' + escHtml(r.description) + '</td>';
    html += '<td class="px-4 py-2.5 text-xs text-gray-600">' + escHtml(r.contractor||'-') + '</td>';
    html += '<td class="px-4 py-2.5 text-right text-sm font-medium text-gray-800">' + _fmtMoney(r.cost) + '</td>';
    html += '<td class="px-4 py-2.5 text-center"><div class="flex gap-1 justify-center">';
    if (AUTH.user.role !== 'employee') {
      html += '<button onclick="openMaintenanceForm(\'' + r.id + '\')" title="แก้ไข" class="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center hover:bg-amber-200"><i class="fi fi-rr-edit text-xs"></i></button>';
      html += '<button onclick="deleteMaintenanceConfirm(\'' + r.id + '\')" title="ลบ" class="w-7 h-7 bg-red-100 text-red-700 rounded-lg flex items-center justify-center hover:bg-red-200"><i class="fi fi-rr-trash text-xs"></i></button>';
    }
    html += '</div></td></tr>';
  });
  html += '</tbody></table></div></div></div>';
  document.getElementById('mainContent').innerHTML = html;
}

function openMaintenanceForm(id) {
  if (AUTH.user.role === 'employee') return;
  var recs = JSON.parse(localStorage.getItem('sup_mock_maintenance_records') || '[]');
  var r = id ? recs.find(function(x){ return x.id === id; }) : null;

  var body = '<div class="space-y-3">';
  body += '<div><label class="form-label">ครุภัณฑ์ *</label><select id="mAssetId" class="form-input">';
  _assetData.forEach(function(a){ body += '<option value="' + a.id + '"' + ((r&&r.asset_id===a.id)?' selected':'') + '>' + escHtml(a.description) + '</option>'; });
  body += '</select></div>';
  body += '<div><label class="form-label">วันที่ซ่อม *</label><input type="date" id="mDate" value="' + escHtml(r?r.maintenance_date:'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">รายละเอียดการซ่อม *</label><textarea id="mDesc" class="form-input" rows="2">' + escHtml(r?r.description:'') + '</textarea></div>';
  body += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
  body += '<div><label class="form-label">ผู้รับเหมา/ผู้ซ่อม</label><input type="text" id="mContractor" value="' + escHtml(r?r.contractor:'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">ค่าใช้จ่าย (บาท)</label><input type="number" id="mCost" value="' + (r?r.cost:'') + '" class="form-input"></div>';
  body += '</div>';
  body += '<div><label class="form-label">หมายเหตุ</label><textarea id="mNote" class="form-input" rows="2">' + escHtml(r?r.notes:'') + '</textarea></div>';
  body += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>';
  if (id) footer += '<button onclick="submitEditMaintenance(\'' + id + '\')" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึก</button>';
  else footer += '<button onclick="submitAddMaintenance()" class="btn-primary"><i class="fi fi-rr-plus mr-1"></i>เพิ่ม</button>';
  openModal(r ? 'แก้ไขประวัติซ่อม' : 'เพิ่มประวัติซ่อม', body, footer);
}

function _readMaintForm() {
  return {
    asset_id: (document.getElementById('mAssetId')||{}).value||'',
    maintenance_date: (document.getElementById('mDate')||{}).value||'',
    description: (document.getElementById('mDesc')||{}).value||'',
    contractor: (document.getElementById('mContractor')||{}).value||'',
    cost: parseFloat((document.getElementById('mCost')||{}).value||0),
    notes: (document.getElementById('mNote')||{}).value||''
  };
}
function submitAddMaintenance() {
  var data = _readMaintForm();
  if (!data.asset_id || !data.maintenance_date || !data.description) { showError('กรุณากรอกข้อมูลที่จำเป็น'); return; }
  showLoading('กำลังบันทึก...');
  callAPI('saveAssetMaintenance', AUTH.token, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderAssetMaintenance(); }
    else showError(res.message);
  }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function submitEditMaintenance(id) {
  var data = _readMaintForm();
  if (!data.asset_id || !data.maintenance_date || !data.description) { showError('กรุณากรอกข้อมูลที่จำเป็น'); return; }
  data.id = id;
  showLoading('กำลังบันทึก...');
  callAPI('saveAssetMaintenance', AUTH.token, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderAssetMaintenance(); }
    else showError(res.message);
  }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function deleteMaintenanceConfirm(id) {
  showConfirm('ลบรายการ', 'ต้องการลบประวัติซ่อมนี้ใช่หรือไม่?', function() {
    showLoading('กำลังลบ...');
    callAPI('deleteAssetMaintenance', AUTH.token, id).then(function(res) {
      hideLoading();
      if (res.success) { showSuccess(res.message); renderAssetMaintenance(); }
      else showError(res.message);
    }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
  }, 'ลบ');
}

function renderAssetCommittees() {
  if (AUTH.user.role === 'employee') { loadPage('dashboard'); return; }
  showLoading('โหลดข้อมูล...');
  callAPI('getAssetCommittees', AUTH.token).then(function(res) {
    hideLoading();
    buildAssetCommitteesPage(res.data || []);
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function buildAssetCommitteesPage(data) {
  var html = '<div class="fade-in space-y-4">';
  html += '<div class="flex items-center justify-between">';
  html += '<h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-users-alt text-navy-600"></i> คณะกรรมการตรวจสอบครุภัณฑ์</h3>';
  if (AUTH.user.role !== 'employee') html += '<button onclick="openCommitteeForm()" class="btn-primary flex items-center gap-2"><i class="fi fi-rr-plus"></i> เพิ่มคณะกรรมการ</button>';
  html += '</div>';
  html += '<div class="card overflow-hidden"><div class="overflow-x-auto">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600">';
  html += '<tr><th class="px-4 py-3 text-left">ปีงบประมาณ</th><th class="px-4 py-3 text-left">ประธานกรรมการ</th><th class="px-4 py-3 text-left">กรรมการ 1</th><th class="px-4 py-3 text-left">กรรมการ 2</th><th class="px-4 py-3 text-center w-24">จัดการ</th></tr></thead>';
  html += '<tbody class="divide-y divide-gray-100">';
  if (!data.length) html += '<tr><td colspan="5" class="text-center py-10 text-gray-400">ไม่พบข้อมูล</td></tr>';
  data.forEach(function(c) {
    html += '<tr><td class="px-4 py-2.5 font-medium text-gray-800 text-sm">' + (c.fiscal_year||'-') + '</td>';
    html += '<td class="px-4 py-2.5"><p class="text-sm text-gray-800">' + escHtml(c.chairman_name||'-') + '</p><p class="text-xs text-gray-500">' + escHtml(c.chairman_position||'') + '</p></td>';
    html += '<td class="px-4 py-2.5"><p class="text-sm text-gray-800">' + escHtml(c.member1_name||'-') + '</p><p class="text-xs text-gray-500">' + escHtml(c.member1_position||'') + '</p></td>';
    html += '<td class="px-4 py-2.5"><p class="text-sm text-gray-800">' + escHtml(c.member2_name||'-') + '</p><p class="text-xs text-gray-500">' + escHtml(c.member2_position||'') + '</p></td>';
    html += '<td class="px-4 py-2.5 text-center"><div class="flex gap-1 justify-center">';
    if (AUTH.user.role !== 'employee') {
      html += '<button onclick="openCommitteeForm(\'' + c.id + '\')" title="แก้ไข" class="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center hover:bg-amber-200"><i class="fi fi-rr-edit text-xs"></i></button>';
      html += '<button onclick="deleteCommitteeConfirm(\'' + c.id + '\')" title="ลบ" class="w-7 h-7 bg-red-100 text-red-700 rounded-lg flex items-center justify-center hover:bg-red-200"><i class="fi fi-rr-trash text-xs"></i></button>';
    }
    html += '</div></td></tr>';
  });
  html += '</tbody></table></div></div></div>';
  document.getElementById('mainContent').innerHTML = html;
}

function openCommitteeForm(id) {
  if (AUTH.user.role === 'employee') return;
  var cms = JSON.parse(localStorage.getItem('sup_mock_committees') || '[]');
  var c = id ? cms.find(function(x){ return x.id === id; }) : null;
  var body = '<div class="space-y-3">';
  body += '<div><label class="form-label">ปีงบประมาณ *</label><input type="number" id="cFiscal" value="' + (c?c.fiscal_year:'') + '" class="form-input"></div>';
  body += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
  body += '<div><label class="form-label">ประธานกรรมการ *</label><input type="text" id="cChairman" value="' + escHtml(c?c.chairman_name:'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">ตำแหน่ง</label><input type="text" id="cChairPos" value="' + escHtml(c?c.chairman_position:'') + '" class="form-input"></div>';
  body += '</div>';
  body += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
  body += '<div><label class="form-label">กรรมการ 1</label><input type="text" id="cM1" value="' + escHtml(c?c.member1_name:'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">ตำแหน่ง</label><input type="text" id="cM1Pos" value="' + escHtml(c?c.member1_position:'') + '" class="form-input"></div>';
  body += '</div>';
  body += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
  body += '<div><label class="form-label">กรรมการ 2</label><input type="text" id="cM2" value="' + escHtml(c?c.member2_name:'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">ตำแหน่ง</label><input type="text" id="cM2Pos" value="' + escHtml(c?c.member2_position:'') + '" class="form-input"></div>';
  body += '</div>';
  body += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>';
  if (id) footer += '<button onclick="submitEditCommittee(\'' + id + '\')" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึก</button>';
  else footer += '<button onclick="submitAddCommittee()" class="btn-primary"><i class="fi fi-rr-plus mr-1"></i>เพิ่ม</button>';
  openModal(c ? 'แก้ไขคณะกรรมการ' : 'เพิ่มคณะกรรมการ', body, footer);
}

function _readCommitteeForm() {
  return {
    fiscal_year: parseInt((document.getElementById('cFiscal')||{}).value||0),
    chairman_name: (document.getElementById('cChairman')||{}).value||'',
    chairman_position: (document.getElementById('cChairPos')||{}).value||'',
    member1_name: (document.getElementById('cM1')||{}).value||'',
    member1_position: (document.getElementById('cM1Pos')||{}).value||'',
    member2_name: (document.getElementById('cM2')||{}).value||'',
    member2_position: (document.getElementById('cM2Pos')||{}).value||''
  };
}
function submitAddCommittee() {
  var data = _readCommitteeForm();
  if (!data.fiscal_year || !data.chairman_name.trim()) { showError('กรุณากรอกข้อมูลที่จำเป็น'); return; }
  showLoading('กำลังบันทึก...');
  callAPI('saveAssetCommittee', AUTH.token, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderAssetCommittees(); }
    else showError(res.message);
  }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function submitEditCommittee(id) {
  var data = _readCommitteeForm();
  if (!data.fiscal_year || !data.chairman_name.trim()) { showError('กรุณากรอกข้อมูลที่จำเป็น'); return; }
  data.id = id;
  showLoading('กำลังบันทึก...');
  callAPI('saveAssetCommittee', AUTH.token, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderAssetCommittees(); }
    else showError(res.message);
  }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function deleteCommitteeConfirm(id) {
  showConfirm('ลบคณะกรรมการ', 'ต้องการลบรายการนี้ใช่หรือไม่?', function() {
    showLoading('กำลังลบ...');
    callAPI('deleteAssetCommittee', AUTH.token, id).then(function(res) {
      hideLoading();
      if (res.success) { showSuccess(res.message); renderAssetCommittees(); }
      else showError(res.message);
    }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
  }, 'ลบ');
}

// ===== DEPRECIATION RATES / USEFUL LIFE =====
function renderDepreciation() {
  showLoading('โหลดข้อมูล...');
  Promise.all([
    callAPI('getAssetCategories', AUTH.token),
    callAPI('getAssetTypes', AUTH.token)
  ]).then(function(res){
    hideLoading();
    if (!res[0].success || !res[1].success) { showError('โหลดข้อมูลไม่สำเร็จ'); return; }
    var cats = res[0].data || [];
    var types = res[1].data || [];
    var html = '<div class="fade-in space-y-4">';
    html += '<div class="card"><div class="card-header"><h3 class="font-semibold text-gray-700 flex items-center gap-2"><i class="fi fi-rr-chart-pie-alt text-navy-600"></i> อัตราค่าเสื่อมราคา / อายุการใช้งาน</h3></div>';
    html += '<div class="card-body"><p class="text-sm text-gray-500 mb-3">จัดการอายุการใช้งานและอัตราค่าเสื่อมราคาตามชนิดครุภัณฑ์</p>';
    html += '<div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600"><tr><th class="px-4 py-2 text-left w-12">#</th><th class="px-4 py-2 text-left">ประเภท</th><th class="px-4 py-2 text-left">ชนิดครุภัณฑ์</th><th class="px-4 py-2 text-center">อายุการใช้งาน (ปี)</th><th class="px-4 py-2 text-center">อัตราค่าเสื่อม (%/ปี)</th><th class="px-4 py-2 text-center w-24">จัดการ</th></tr></thead><tbody class="divide-y divide-gray-100">';
    var rowNum = 0;
    cats.forEach(function(cat){
      var catTypes = types.filter(function(t){ return t.category_id === cat.id; });
      catTypes.forEach(function(t, idx){
        rowNum++;
        var life = t.useful_life ? parseInt(t.useful_life) : null;
        var rate = t.depreciation_rate ? parseFloat(t.depreciation_rate) : null;
        var rateDisplay = rate !== null ? rate.toFixed(2) + '%' : '<span class="text-gray-300">-</span>';
        var lifeDisplay = life !== null ? life : '<span class="text-gray-300">-</span>';
        html += '<tr>';
        html += '<td class="px-4 py-2 text-gray-500">' + rowNum + '</td>';
        html += '<td class="px-4 py-2 font-medium text-gray-800">' + (idx===0 ? escHtml(cat.name) : '') + '</td>';
        html += '<td class="px-4 py-2 text-gray-700">' + escHtml(t.name) + '</td>';
        html += '<td class="px-4 py-2 text-center font-medium text-blue-600">' + lifeDisplay + '</td>';
        html += '<td class="px-4 py-2 text-center font-medium text-amber-600">' + rateDisplay + '</td>';
        html += '<td class="px-4 py-2 text-center"><button onclick="openDepreciationForm(' + JSON.stringify(t).replace(/"/g,'&quot;') + ',' + JSON.stringify(cat).replace(/"/g,'&quot;') + ')" class="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center hover:bg-amber-200"><i class="fi fi-rr-edit text-xs"></i></button></td>';
        html += '</tr>';
      });
    });
    if (!rowNum) html += '<tr><td colspan="6" class="text-center py-6 text-gray-400">ไม่มีข้อมูล</td></tr>';
    html += '</tbody></table></div>';
    html += '</div></div></div>';
    document.getElementById('mainContent').innerHTML = html;
  }).catch(function(){ hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function openDepreciationForm(type, cat) {
  type = type || {};
  cat = cat || {};
  var body = '<div class="space-y-4">';
  body += '<input type="hidden" id="depTypeId" value="' + (type.id||'') + '">';
  body += '<div class="bg-gray-50 rounded-lg p-3">';
  body += '<p class="text-xs text-gray-500">ชนิดครุภัณฑ์</p>';
  body += '<p class="font-semibold text-gray-800">' + escHtml(type.name||'') + '</p>';
  body += '<p class="text-xs text-gray-500 mt-1">' + escHtml(cat.name||'') + '</p>';
  body += '</div>';
  body += '<div class="grid grid-cols-2 gap-3">';
  body += '<div><label class="form-label">อายุการใช้งาน (ปี)</label><input type="number" id="depLife" value="' + (type.useful_life||'') + '" class="form-input" placeholder="เช่น 5"></div>';
  body += '<div><label class="form-label">อัตราค่าเสื่อม (%/ปี)</label><input type="number" id="depRate" value="' + (type.depreciation_rate||'') + '" class="form-input" placeholder="เช่น 20" step="0.01"></div>';
  body += '</div>';
  body += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>';
  footer += '<button onclick="submitDepreciation()" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึก</button>';
  openModal('แก้ไขค่าเสื่อมราคา', body, footer);
}

function submitDepreciation() {
  var typeId = document.getElementById('depTypeId').value;
  var life = parseInt(document.getElementById('depLife').value||0)||null;
  var rate = parseFloat(document.getElementById('depRate').value||0)||null;
  showLoading('กำลังบันทึก...');
  callAPI('getAssetTypes', AUTH.token).then(function(res){
    if (!res.success) { hideLoading(); showError(res.message); return; }
    var type = (res.data||[]).find(function(t){ return t.id === typeId; });
    if (!type) { hideLoading(); showError('ไม่พบข้อมูล'); return; }
    type.useful_life = life;
    type.depreciation_rate = rate;
    return callAPI('saveAssetType', AUTH.token, type);
  }).then(function(res){
    hideLoading(); closeModal();
    if (res && res.success) { showSuccess(res.message); renderDepreciation(); }
    else if (res) showError(res.message);
  }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
}

// ===== ASSET REGISTER (ทะเบียนคุมสินทรัพย์รายตัว) =====
var _regAssets = [], _regTypes = [], _regCats = [], _regAmphoes = [], _regFiscal = '', _regAmphoe = 'all', _regCat = 'all', _regSearch = '';

function renderAssetRegister() {
  if (AUTH.user.role === 'employee') { loadPage('dashboard'); return; }
  _regFiscal = ''; _regAmphoe = 'all'; _regCat = 'all'; _regSearch = '';
  showLoading('โหลดข้อมูล...');
  Promise.all([
    callAPI('getAssets', AUTH.token),
    callAPI('getAssetCategories', AUTH.token),
    callAPI('getAssetTypes', AUTH.token),
    callAPI('getAmphoes', AUTH.token),
    callAPI('getFiscalYears', AUTH.token)
  ]).then(function(res) {
    hideLoading();
    _regAssets = (res[0].data || []).slice().sort(function(a,b){ return (a.asset_code||'').localeCompare(b.asset_code||''); });
    _regCats = res[1].data || [];
    _regTypes = res[2].data || [];
    _regAmphoes = res[3].data || [];
    var fyData = res[4].data || [];
    _buildRegisterPage(fyData);
  }).catch(function(){ hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function _buildRegisterPage(fyData) {
  var fyList = fyData || [];

  // Compute net value for each asset
  function _netValue(a) {
    var type = _regTypes.find(function(t){ return t.id === a.type_id; });
    var price = parseFloat(a.unit_price || 0);
    var life = type && type.useful_life ? parseInt(type.useful_life) : 0;
    var rate = type && type.depreciation_rate ? parseFloat(type.depreciation_rate) : 0;
    if (!life && !rate) return price;
    var annualDep = rate > 0 ? price * (rate / 100) : price / life;
    var receiveDate = a.receive_date ? new Date(a.receive_date) : null;
    var now = new Date();
    var yearsUsed = receiveDate ? (now - receiveDate) / (1000 * 60 * 60 * 24 * 365.25) : 0;
    var accumulated = Math.min(annualDep * yearsUsed, price - 1);
    return Math.max(price - accumulated, 1);
  }

  function _depRate(a) {
    var type = _regTypes.find(function(t){ return t.id === a.type_id; });
    return type && type.depreciation_rate ? parseFloat(type.depreciation_rate).toFixed(2) + '%' : '-';
  }

  // Filter
  var assets = _regAssets.filter(function(a) {
    if (_regFiscal && String(a.fiscal_year||'') !== String(_regFiscal)) return false;
    if (_regAmphoe !== 'all' && a.amphoe_id !== _regAmphoe) return false;
    if (_regCat !== 'all' && a.category_id !== _regCat) return false;
    if (_regSearch) {
      var s = _regSearch.toLowerCase();
      if ((a.asset_code||'').toLowerCase().indexOf(s) < 0 &&
          (a.description||'').toLowerCase().indexOf(s) < 0 &&
          (a.serial_number||'').toLowerCase().indexOf(s) < 0 &&
          (a.gfmis_number||'').toLowerCase().indexOf(s) < 0) return false;
    }
    return true;
  });

  var html = '<div class="fade-in space-y-4">';

  // Filter bar
  html += '<div class="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">';
  // ปีงบประมาณ
  html += '<div class="min-w-[140px]"><label class="text-xs text-gray-500 mb-1 block font-medium">ปีงบประมาณ</label>';
  html += '<select id="regFiscal" onchange="_regUpdateFilter()" class="form-input text-sm">';
  html += '<option value="">ทุกปี</option>';
  fyList.forEach(function(f){ html += '<option value="' + f.year + '"' + (_regFiscal==f.year?' selected':'') + '>' + f.year + (f.is_active!==false?' (ปัจจุบัน)':'') + '</option>'; });
  html += '</select></div>';
  // หน่วยงาน
  html += '<div class="min-w-[160px]"><label class="text-xs text-gray-500 mb-1 block font-medium">หน่วยงาน</label>';
  html += '<select id="regAmphoe" onchange="_regUpdateFilter()" class="form-input text-sm">';
  html += '<option value="all">ทุกหน่วยงาน</option>';
  _regAmphoes.forEach(function(am){ html += '<option value="' + am.id + '"' + (_regAmphoe===am.id?' selected':'') + '>' + escHtml(am.name) + '</option>'; });
  html += '</select></div>';
  // ประเภท
  html += '<div class="min-w-[160px]"><label class="text-xs text-gray-500 mb-1 block font-medium">ประเภท</label>';
  html += '<select id="regCat" onchange="_regUpdateFilter()" class="form-input text-sm">';
  html += '<option value="all">ทุกประเภท</option>';
  _regCats.forEach(function(c){ html += '<option value="' + c.id + '"' + (_regCat===c.id?' selected':'') + '>' + escHtml(c.name) + '</option>'; });
  html += '</select></div>';
  // ค้นหา
  html += '<div class="flex-1 min-w-[200px]"><label class="text-xs text-gray-500 mb-1 block font-medium">ค้นหา</label>';
  html += '<div class="flex gap-2"><input id="regSearch" type="text" class="form-input text-sm flex-1" placeholder="รหัส / ชื่อ / S/N / GFMIS" value="' + escHtml(_regSearch) + '" onkeydown="if(event.key===\'Enter\') _regUpdateFilter()"><button onclick="_regUpdateFilter()" class="btn-primary btn-sm flex items-center gap-1 px-4"><i class="fi fi-rr-search"></i> ค้นหา</button><button onclick="_regResetFilter()" class="btn-secondary btn-sm px-3" title="รีเซ็ต"><i class="fi fi-rr-refresh"></i></button></div></div>';
  html += '<div class="self-end text-xs text-gray-500 whitespace-nowrap">พบ ' + assets.length + ' รายการ</div>';
  html += '</div>';

  // Table
  html += '<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">';
  html += '<div class="overflow-x-auto">';
  html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-xs text-gray-600 border-b border-gray-200">';
  html += '<tr>';
  html += '<th class="px-3 py-3 text-center w-10">ลำดับ</th>';
  html += '<th class="px-3 py-3 text-left">รหัสครุภัณฑ์</th>';
  html += '<th class="px-3 py-3 text-left">รายการ</th>';
  html += '<th class="px-3 py-3 text-left">ประเภท</th>';
  html += '<th class="px-3 py-3 text-left">หน่วยงาน</th>';
  html += '<th class="px-3 py-3 text-center">วันที่ได้รับ</th>';
  html += '<th class="px-3 py-3 text-right">ราคาทุน</th>';
  html += '<th class="px-3 py-3 text-center">อัตราเสื่อม%</th>';
  html += '<th class="px-3 py-3 text-right" style="color:#c0392b;">มูลค่าสุทธิ</th>';
  html += '<th class="px-3 py-3 text-center">จัดการ</th>';
  html += '</tr></thead><tbody class="divide-y divide-gray-100">';

  if (!assets.length) {
    html += '<tr><td colspan="10" class="text-center py-10 text-gray-400">ไม่พบข้อมูลครุภัณฑ์</td></tr>';
  } else {
    assets.forEach(function(a, idx) {
      var cat = _regCats.find(function(c){ return c.id === a.category_id; });
      var amphoe = _regAmphoes.find(function(am){ return am.id === a.amphoe_id; });
      var net = _netValue(a);
      var rate = _depRate(a);
      var price = parseFloat(a.unit_price || 0);
      html += '<tr class="hover:bg-gray-50">';
      html += '<td class="px-3 py-2.5 text-center text-gray-500">' + (idx+1) + '</td>';
      html += '<td class="px-3 py-2.5 text-xs font-medium text-emerald-700">' + escHtml(a.asset_code||'-') + '</td>';
      html += '<td class="px-3 py-2.5"><p class="font-medium text-gray-800 text-sm leading-snug">' + escHtml(a.description||'-') + '</p><p class="text-xs text-gray-400">' + escHtml(a.brand_model||'') + '</p></td>';
      html += '<td class="px-3 py-2.5 text-xs text-gray-600">' + escHtml(cat ? cat.name : '-') + '</td>';
      html += '<td class="px-3 py-2.5 text-xs text-emerald-700 font-medium">' + escHtml(amphoe ? amphoe.name : '-') + '</td>';
      html += '<td class="px-3 py-2.5 text-center text-xs text-gray-600">' + escHtml(formatDate(a.receive_date)||'-') + '</td>';
      html += '<td class="px-3 py-2.5 text-right text-sm text-gray-800">' + _fmtMoney(price) + '</td>';
      html += '<td class="px-3 py-2.5 text-center text-xs text-gray-600">' + rate + '</td>';
      html += '<td class="px-3 py-2.5 text-right text-sm font-semibold" style="color:#c0392b;">' + _fmtMoney(net) + '</td>';
      html += '<td class="px-3 py-2.5"><div class="flex gap-1.5 justify-center">';
      html += '<button onclick="printAssetRegister(\'' + a.id + '\')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700"><i class="fi fi-rr-book-open-cover"></i> ทะเบียน</button>';
      html += '<button onclick="window.open(\'?public_asset_id=' + a.id + '\', \'_blank\')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700"><i class="fi fi-rr-eye"></i> ดูรายละเอียด</button>';
      html += '</div></td>';
      html += '</tr>';
    });
  }
  html += '</tbody></table></div></div></div>';
  document.getElementById('mainContent').innerHTML = html;
}

function _regUpdateFilter() {
  _regFiscal = (document.getElementById('regFiscal')||{}).value || '';
  _regAmphoe = (document.getElementById('regAmphoe')||{}).value || 'all';
  _regCat = (document.getElementById('regCat')||{}).value || 'all';
  _regSearch = (document.getElementById('regSearch')||{}).value || '';
  _buildRegisterPage(_settingsFiscalYears.length ? _settingsFiscalYears : []);
}

function _regResetFilter() {
  _regFiscal = ''; _regAmphoe = 'all'; _regCat = 'all'; _regSearch = '';
  _buildRegisterPage(_settingsFiscalYears.length ? _settingsFiscalYears : []);
}

var _arTab = 'list', _arFiscal = '', _arAmphoe = 'all', _arCat = 'all', _arStatus = 'all';
var _arAssets = [], _arCats = [], _arAmphoes = [], _arCommittee = null;

function renderAssetReports() {
  if (AUTH.user.role === 'employee') { loadPage('dashboard'); return; }
  showLoading('โหลดข้อมูล...');
  Promise.all([
    callAPI('getAssets', AUTH.token),
    callAPI('getAssetCategories', AUTH.token),
    callAPI('getAmphoes', AUTH.token),
    callAPI('getAssetCommittees', AUTH.token)
  ]).then(function(res) {
    hideLoading();
    _arAssets = res[0].data || [];
    _arCats = res[1].data || [];
    _arAmphoes = res[2].data || [];
    var comm = res[3].data || [];
    _arCommittee = comm.length ? comm[0] : null;
    buildAssetReportsPage();
  }).catch(function() { hideLoading(); showError('โหลดข้อมูลไม่สำเร็จ'); });
}

function _arFiltered() {
  return _arAssets.filter(function(a) {
    if (_arFiscal && String(a.fiscal_year||'') !== String(_arFiscal)) return false;
    if (_arAmphoe !== 'all' && a.amphoe_id !== _arAmphoe) return false;
    if (_arCat !== 'all' && a.category_id !== _arCat) return false;
    if (_arStatus !== 'all' && a.status !== _arStatus) return false;
    return true;
  });
}

function buildAssetReportsPage() {
  var assets = _arFiltered();
  var html = '<div class="fade-in space-y-4">';

  // Tabs
  html += '<div class="flex gap-2 border-b border-gray-200 mb-2">';
  html += '<button onclick="_arSetTab(\'list\')" class="px-4 py-2 text-sm font-medium ' + (_arTab==='list'?'text-navy-700 border-b-2 border-navy-700':'text-gray-500 hover:text-gray-700') + '">รายการครุภัณฑ์</button>';
  html += '<button onclick="_arSetTab(\'summary\')" class="px-4 py-2 text-sm font-medium ' + (_arTab==='summary'?'text-navy-700 border-b-2 border-navy-700':'text-gray-500 hover:text-gray-700') + '">สรุปรายงานครุภัณฑ์</button>';
  html += '<button onclick="_arSetTab(\'disposed\')" class="px-4 py-2 text-sm font-medium ' + (_arTab==='disposed'?'text-navy-700 border-b-2 border-navy-700':'text-gray-500 hover:text-gray-700') + '">สรุปครุภัณฑ์ที่จำหน่ายแล้ว</button>';
  html += '</div>';

  // Filters
  html += '<div id="arFilters" class="flex flex-wrap gap-2 items-end bg-white rounded-xl border border-gray-200 p-3">';
  html += '<div class="flex-1 min-w-[140px]"><label class="text-xs text-gray-500 mb-1 block">ปีงบประมาณ</label><select id="arFiscal" onchange="_arUpdateFilter()" class="form-input text-sm">';
  html += '<option value="">ทั้งหมด</option>';
  var fyList = _settingsFiscalYears.length ? _settingsFiscalYears.map(function(f){ return f.year; }) : [];
  if (!fyList.length) {
    var assetYears = {};
    _arAssets.forEach(function(a){ if(a.fiscal_year) assetYears[a.fiscal_year]=1; });
    fyList = Object.keys(assetYears).sort().reverse();
  }
  fyList.forEach(function(y){ html += '<option value="' + y + '"' + (_arFiscal==y?' selected':'') + '>' + y + '</option>'; });
  html += '</select></div>';
  html += '<div class="flex-1 min-w-[140px]"><label class="text-xs text-gray-500 mb-1 block">หน่วยงาน</label><select id="arAmphoe" onchange="_arUpdateFilter()" class="form-input text-sm">';
  html += '<option value="all">ทุกหน่วยงาน</option>';
  _arAmphoes.forEach(function(am){ html += '<option value="' + am.id + '"' + (_arAmphoe===am.id?' selected':'') + '>' + escHtml(am.name) + '</option>'; });
  html += '</select></div>';
  html += '<div class="flex-1 min-w-[140px]"><label class="text-xs text-gray-500 mb-1 block">ประเภทครุภัณฑ์</label><select id="arCat" onchange="_arUpdateFilter()" class="form-input text-sm">';
  html += '<option value="all">ทุกประเภท</option>';
  _arCats.forEach(function(c){ html += '<option value="' + c.id + '"' + (_arCat===c.id?' selected':'') + '>' + escHtml(c.name) + '</option>'; });
  html += '</select></div>';
  html += '<div class="flex-1 min-w-[120px]"><label class="text-xs text-gray-500 mb-1 block">สถานะ</label><select id="arStatus" onchange="_arUpdateFilter()" class="form-input text-sm">';
  html += '<option value="all">ทุกสถานะ</option>';
  html += '<option value="active"' + (_arStatus==='active'?' selected':'') + '>ใช้งานได้</option>';
  html += '<option value="damaged"' + (_arStatus==='damaged'?' selected':'') + '>ชำรุด/รอจำหน่าย</option>';
  html += '<option value="disposed"' + (_arStatus==='disposed'?' selected':'') + '>จำหน่ายแล้ว</option>';
  html += '</select></div>';
  html += '<div class="flex gap-2"><button onclick="_arUpdateFilter()" class="btn-primary btn-sm"><i class="fi fi-rr-search mr-1"></i>ค้นหา</button>';
  html += '<button onclick="_arDoPrint()" class="btn-secondary btn-sm"><i class="fi fi-rr-print mr-1"></i>พิมพ์</button></div>';
  html += '</div>';

  if (_arTab === 'list') html += _arBuildList(assets);
  else if (_arTab === 'summary') html += _arBuildSummary(assets);
  else if (_arTab === 'disposed') html += _arBuildDisposed(assets);

  html += '</div>';
  document.getElementById('mainContent').innerHTML = html;
  if (_arTab === 'list') setTimeout(_arRenderQRs, 50);
}

function _arSetTab(tab) { _arTab = tab; buildAssetReportsPage(); }
function _arUpdateFilter() {
  _arFiscal = (document.getElementById('arFiscal')||{}).value||'';
  _arAmphoe = (document.getElementById('arAmphoe')||{}).value||'all';
  _arCat = (document.getElementById('arCat')||{}).value||'all';
  _arStatus = (document.getElementById('arStatus')||{}).value||'all';
  buildAssetReportsPage();
}

function _arBuildList(assets) {
  var html = '<div class="card overflow-hidden" id="arPrintArea">';
  html += _arPrintHeader('รายงานการตรวจสอบพัสดุประจำปีงบประมาณ พ.ศ. ' + (_arFiscal || '...'));
  html += '<div class="overflow-x-auto">';
  html += '<table class="w-full text-xs ar-table"><thead><tr>';
  html += '<th>ลำดับ</th><th>วันที่ได้รับ/<br>จัดซื้อ</th><th>เลขที่สินทรัพย์/<br>เลขที่ใบ GFMIS</th>';
  html += '<th>รหัสครุภัณฑ์</th><th>ประเภท</th><th>ชนิด</th><th>รายการ</th><th>ราคา/<br>หน่วย</th>';
  html += '<th>วิธีการ<br>ได้มา</th><th>สถานที่<br>ใช้งาน</th><th>ผู้ใช้</th><th>สถานะ</th><th>QR Code</th>';
  html += '</tr></thead><tbody>';
  if (!assets.length) html += '<tr><td colspan="13" class="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr>';
  assets.forEach(function(a, i) {
    html += '<tr>';
    html += '<td class="text-center">' + (i+1) + '</td>';
    html += '<td>' + escHtml(a.receive_date||'-') + '</td>';
    html += '<td>' + escHtml(a.asset_number||'') + '<br><span class="text-gray-500">' + escHtml(a.gfmis_number||'') + '</span></td>';
    html += '<td>' + escHtml(a.asset_code||'') + '</td>';
    html += '<td>' + escHtml(_getAssetCatName(a.category_id)) + '</td>';
    html += '<td>' + escHtml(_getAssetTypeName(a.type_id)) + '</td>';
    html += '<td>' + escHtml(a.description||'') + '</td>';
    html += '<td class="text-right">' + _fmtMoney(a.unit_price) + '</td>';
    html += '<td>' + escHtml(a.acquisition_method||'') + '</td>';
    html += '<td>' + escHtml(a.location||'') + '</td>';
    html += '<td>' + escHtml(a.created_by||'') + '</td>';
    html += '<td>' + _assetStatusLabel(a.status) + '</td>';
    html += '<td class="text-center"><div id="ar-qr-' + a.id + '" class="ar-qr inline-block"></div></td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  html += _arPrintFooter();
  html += '</div>';
  return html;
}

function _arBuildSummary(assets) {
  var html = '<div class="card overflow-hidden" id="arPrintArea">';
  html += _arPrintHeader('สรุปรายงานการตรวจสอบพัสดุประจำปีงบประมาณ พ.ศ. ' + (_arFiscal || '...'));
  html += '<div class="overflow-x-auto">';
  html += '<table class="w-full text-xs ar-table"><thead><tr>';
  html += '<th>ลำดับ</th><th>หน่วยนับ</th><th>จำนวนรายการ/<br>ชิ้น</th><th>ราคา</th><th>อัตราครุภัณฑ์</th><th>ส่งคืน/<br>จำหน่ายไปแล้ว</th><th>รวม</th>';
  html += '</tr></thead><tbody>';

  var grandTotal = 0, grandActive = 0, grandDisposed = 0;
  var rows = [];
  _arCats.forEach(function(c) {
    var catAssets = assets.filter(function(a){ return a.category_id === c.id; });
    if (!catAssets.length) return;
    var count = catAssets.length;
    var value = catAssets.reduce(function(s,a){ return s + (a.unit_price||0); }, 0);
    var disposedCount = catAssets.filter(function(a){ return a.status === 'disposed'; }).length;
    rows.push({ name: c.name, count: count, value: value, disposed: disposedCount });
    grandTotal += count; grandActive += (count - disposedCount); grandDisposed += disposedCount;
  });

  if (!rows.length) html += '<tr><td colspan="7" class="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr>';
  rows.forEach(function(r, i) {
    html += '<tr>';
    html += '<td class="text-center">' + (i+1) + '</td>';
    html += '<td>' + escHtml(r.name) + '</td>';
    html += '<td class="text-right">' + r.count + '</td>';
    html += '<td class="text-right">' + _fmtMoney(r.value) + '</td>';
    html += '<td class="text-right">' + (r.count - r.disposed) + '</td>';
    html += '<td class="text-right">' + r.disposed + '</td>';
    html += '<td class="text-right font-semibold">' + r.count + '</td>';
    html += '</tr>';
  });
  html += '<tr class="ar-total"><td colspan="2" class="text-center">รวมทั้งสิ้น</td>';
  html += '<td class="text-right">' + grandTotal + '</td>';
  html += '<td class="text-right">' + _fmtMoney(assets.reduce(function(s,a){ return s + (a.unit_price||0); }, 0)) + '</td>';
  html += '<td class="text-right">' + grandActive + '</td>';
  html += '<td class="text-right">' + grandDisposed + '</td>';
  html += '<td class="text-right">' + grandTotal + '</td></tr>';
  html += '</tbody></table></div>';
  html += _arPrintFooter();
  html += '</div>';
  return html;
}

function _arRenderQRs() {
  if (typeof QRCode === 'undefined') return;
  var assets = _arFiltered();
  assets.forEach(function(a) {
    var el = document.getElementById('ar-qr-' + a.id);
    if (!el) return;
    el.innerHTML = '';
    try {
      new QRCode(el, {
        text: a.asset_code || a.id,
        width: 48,
        height: 48,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch(e) {}
  });
}

function _arBuildDisposed(assets) {
  var disposed = assets.filter(function(a){ return a.status === 'disposed'; });
  var html = '<div class="card overflow-hidden" id="arPrintArea">';
  html += _arPrintHeader('สรุปครุภัณฑ์ที่จำหน่ายแล้ว ประจำปีงบประมาณ พ.ศ. ' + (_arFiscal || '...'));
  html += '<div class="overflow-x-auto">';
  html += '<table class="w-full text-xs ar-table"><thead><tr>';
  html += '<th>ลำดับ</th><th>วันที่ได้รับ/<br>จัดซื้อ</th><th>รหัสครุภัณฑ์</th>';
  html += '<th>รายการ</th><th>ราคา</th><th>หน่วยงาน</th><th>หมายเหตุ</th>';
  html += '</tr></thead><tbody>';
  if (!disposed.length) html += '<tr><td colspan="7" class="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr>';
  disposed.forEach(function(a, i) {
    html += '<tr>';
    html += '<td class="text-center">' + (i+1) + '</td>';
    html += '<td>' + escHtml(a.receive_date||'-') + '</td>';
    html += '<td>' + escHtml(a.asset_code||'') + '</td>';
    html += '<td>' + escHtml(a.description||'') + '</td>';
    html += '<td class="text-right">' + _fmtMoney(a.unit_price) + '</td>';
    html += '<td>' + escHtml(_getAmphoeName(a.amphoe_id)) + '</td>';
    html += '<td>' + escHtml(a.notes||'') + '</td>';
    html += '</tr>';
  });
  html += '<tr class="ar-total"><td colspan="4" class="text-center">รวม</td>';
  html += '<td class="text-right">' + _fmtMoney(disposed.reduce(function(s,a){ return s + (a.unit_price||0); }, 0)) + '</td>';
  html += '<td colspan="2"></td></tr>';
  html += '</tbody></table></div>';
  html += _arPrintFooter();
  html += '</div>';
  return html;
}

function _arDoPrint() {
  var el = document.getElementById('arPrintArea');
  if (!el) { showError('ไม่พบข้อมูลสำหรับพิมพ์'); return; }
  var content = el.innerHTML;
  var win = window.open('', '_blank');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>รายงานการตรวจสอบพัสดุ</title>' +
    '<style>' +
    '@page{size:A4 landscape;margin:0}' +
    'html,body{margin:0;padding:0}' +
    'body{font-family:sarabun,sans-serif;font-size:10px;color:#000;background:#fff}' +
    '.ar-wrap{padding:12mm 14mm}' +
    '*{box-sizing:border-box;word-break:break-word;overflow-wrap:break-word}' +
    'table{border-collapse:collapse;width:100%;table-layout:fixed}' +
    'th,td{border:1px solid #999;padding:3px 4px;font-size:9px;vertical-align:top;word-break:break-word}' +
    'th{background:#f3f4f6 !important;text-align:center;font-weight:600;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.ar-print-header{text-align:center;padding-bottom:8px;border-bottom:2px solid #333;margin-bottom:10px}' +
    '.ar-print-header h2{font-size:13px;font-weight:700;margin:4px 0}' +
    '.ar-print-header p{font-size:10px;margin:2px 0}' +
    '.ar-header-logo{width:40px;height:40px;object-fit:contain}' +
    '.ar-print-footer{margin-top:20px}' +
    '.ar-print-footer .grid{display:flex;justify-content:space-around}' +
    '.ar-print-footer .grid>div{text-align:center;font-size:10px}' +
    'canvas,img.ar-qr{width:60px !important;height:60px !important}' +
    '@media print{.no-print{display:none}body{font-size:9px}}' +
    '</style>' +
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>' +
    '</head><body><div class="ar-wrap">' + content + '</div>' +
    '<script>' +
    'document.querySelectorAll("[data-qr-url]").forEach(function(el){' +
    '  new QRCode(el,{text:el.getAttribute("data-qr-url"),width:60,height:60,correctLevel:1});' +
    '});' +
    'setTimeout(function(){window.print();},800);' +
    '<\/script>' +
    '</body></html>');
  win.document.close();
}

function _arPrintHeader(title) {
  var cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('sup_config') || '{}'); } catch(e) {}
  var org = cfg.organization_name || '';
  var appName = cfg.app_name || 'ระบบวัสดุสิ้นเปลือง';
  var logoUrl = cfg.app_logo ? imgUrl(cfg.app_logo) : '';
  var html = '<div class="ar-print-header text-center py-3 border-b-2 border-gray-800 mb-3">';
  if (logoUrl) html += '<img src="' + logoUrl + '" class="ar-header-logo mx-auto mb-1" alt="logo">';
  html += '<p class="text-xs text-gray-600 font-semibold">' + escHtml(appName) + '</p>';
  html += '<h2 class="text-base font-bold mt-1">' + escHtml(title) + '</h2>';
  if (org) html += '<p class="text-sm">' + escHtml(org) + '</p>';
  if (_arFiscal) html += '<p class="text-xs text-gray-600">ประจำปีงบประมาณ พ.ศ. ' + _arFiscal + '</p>';
  html += '</div>';
  return html;
}

function _arPrintFooter() {
  if (!_arCommittee) return '';
  var c = _arCommittee;
  var html = '<div class="ar-print-footer mt-8 pt-4">';
  html += '<div class="grid grid-cols-3 gap-4 text-center text-xs mt-8">';
  html += '<div><p>(ลงชื่อ)................................................</p><p>ประธานกรรมการ</p><p>(' + escHtml(c.chairman_name||'') + ')</p><p>' + escHtml(c.chairman_position||'') + '</p></div>';
  html += '<div><p>(ลงชื่อ)................................................</p><p>กรรมการ</p><p>(' + escHtml(c.member1_name||'') + ')</p><p>' + escHtml(c.member1_position||'') + '</p></div>';
  html += '<div><p>(ลงชื่อ)................................................</p><p>กรรมการ</p><p>(' + escHtml(c.member2_name||'') + ')</p><p>' + escHtml(c.member2_position||'') + '</p></div>';
  html += '</div></div>';
  return html;
}

// ===== ON LOAD =====
window.onload = function() {
  // Parse URL params immediately — before any async call
  var urlParams = new URLSearchParams(window.location.search);
  _QR_ACTION = urlParams.get('action') || '';
  _QR_ITEM_ID = urlParams.get('item_id') || '';
  _QR_ASSET_ID = urlParams.get('id') || '';
  _PUBLIC_ASSET_ID = urlParams.get('public_asset_id') || '';

  // If public asset page: render immediately without login
  if (_PUBLIC_ASSET_ID) {
    renderPublicAssetPage();
    return;
  }

  // Initialize login particles
  initLoginParticles();

  // Otherwise: fetch config then decide login or app
  callAPI('getConfig').then(function(res) {
    if (res.success && res.data) {
      var cfg = res.data;
      if (cfg.app_name) {
        document.getElementById('loginAppName').textContent = cfg.app_name;
        document.getElementById('loginAppNameMobile').textContent = cfg.app_name;
        document.getElementById('sidebarAppName').textContent = cfg.app_name;
      }
      updateLogoDisplay(cfg.app_logo);
    }
  }).catch(function() {}).finally(function() {
    if (AUTH.token) { initApp(); }
    else { showLoginPage(); }
  });
};

// ===== MASTER DATA CRUD (Settings) =====
function openCatForm(cat) {
  cat = cat || {};
  var body = '<div class="space-y-3">';
  body += '<input type="hidden" id="catId" value="' + (cat.id||'') + '">';
  body += '<div><label class="form-label">ชื่อประเภทครุภัณฑ์ *</label><input type="text" id="catName" value="' + escHtml(cat.name||'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">คำอธิบาย</label><input type="text" id="catDesc" value="' + escHtml(cat.description||'') + '" class="form-input"></div>';
  body += '<div class="flex items-center gap-4">';
  body += '<div class="flex items-center gap-2"><input type="checkbox" id="catRequiresSerial" ' + (cat.requires_serial===true?'checked':'') + ' class="w-4 h-4 rounded accent-navy-700"><label for="catRequiresSerial" class="text-sm text-gray-700">บังคับกรอก Serial/License</label></div>';
  body += '<div class="flex items-center gap-2"><input type="checkbox" id="catIsSoftware" ' + (cat.is_software===true?'checked':'') + ' class="w-4 h-4 rounded accent-navy-700"><label for="catIsSoftware" class="text-sm text-gray-700">เป็นซอฟต์แวร์</label></div>';
  body += '</div>';
  body += '<div class="flex items-center gap-2"><input type="checkbox" id="catActive" ' + (cat.is_active!==false?'checked':'') + ' class="w-4 h-4 rounded accent-navy-700"><label for="catActive" class="text-sm text-gray-700">ใช้งาน</label></div>';
  body += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>';
  footer += '<button onclick="submitCat()" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึก</button>';
  openModal(cat.id ? 'แก้ไขประเภทครุภัณฑ์' : 'เพิ่มประเภทครุภัณฑ์', body, footer);
}
function submitCat() {
  var data = { id: document.getElementById('catId').value, name: document.getElementById('catName').value.trim(), description: document.getElementById('catDesc').value.trim(), is_active: document.getElementById('catActive').checked, requires_serial: document.getElementById('catRequiresSerial').checked, is_software: document.getElementById('catIsSoftware').checked };
  if (!data.name) { showError('กรุณากรอกชื่อประเภท'); return; }
  showLoading('กำลังบันทึก...');
  callAPI('saveAssetCategory', AUTH.token, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderSettings(); }
    else showError(res.message);
  }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function deleteCatConfirm(id, name) {
  showConfirm('ลบประเภทครุภัณฑ์', 'ยืนยันลบ "' + name + '" ?', function(){
    showLoading('กำลังลบ...');
    callAPI('deleteAssetCategory', AUTH.token, id).then(function(res) {
      hideLoading();
      if (res.success) { showSuccess(res.message); renderSettings(); }
      else showError(res.message);
    }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
  }, 'ลบ');
}

function openTypeForm(type) {
  type = type || {};
  var body = '<div class="space-y-3">';
  body += '<input type="hidden" id="typeId" value="' + (type.id||'') + '">';
  body += '<div><label class="form-label">ชื่อชนิดครุภัณฑ์ *</label><input type="text" id="typeName" value="' + escHtml(type.name||'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">ประเภทครุภัณฑ์ *</label><select id="typeCatId" class="form-input">';
  body += '<option value="">เลือกประเภท</option>';
  _settingsCats.forEach(function(c){ body += '<option value="' + c.id + '"' + ((type.category_id===c.id)?' selected':'') + '>' + escHtml(c.name) + '</option>'; });
  body += '</select></div>';
  body += '<div class="grid grid-cols-2 gap-3">';
  body += '<div><label class="form-label">อายุการใช้งาน (ปี)</label><input type="number" id="typeLife" value="' + (type.useful_life||'') + '" class="form-input" placeholder="เช่น 5"></div>';
  body += '<div><label class="form-label">อัตราค่าเสื่อม (%/ปี)</label><input type="number" id="typeRate" value="' + (type.depreciation_rate||'') + '" class="form-input" placeholder="เช่น 20" step="0.01"></div>';
  body += '</div>';
  body += '<div class="flex items-center gap-2"><input type="checkbox" id="typeActive" ' + (type.is_active!==false?'checked':'') + ' class="w-4 h-4 rounded accent-navy-700"><label for="typeActive" class="text-sm text-gray-700">ใช้งาน</label></div>';
  body += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>';
  footer += '<button onclick="submitType()" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึก</button>';
  openModal(type.id ? 'แก้ไขชนิดครุภัณฑ์' : 'เพิ่มชนิดครุภัณฑ์', body, footer);
}
function submitType() {
  var data = { id: document.getElementById('typeId').value, name: document.getElementById('typeName').value.trim(), category_id: document.getElementById('typeCatId').value, is_active: document.getElementById('typeActive').checked, useful_life: parseInt(document.getElementById('typeLife').value||0)||null, depreciation_rate: parseFloat(document.getElementById('typeRate').value||0)||null };
  if (!data.name || !data.category_id) { showError('กรุณากรอกชื่อและเลือกประเภท'); return; }
  showLoading('กำลังบันทึก...');
  callAPI('saveAssetType', AUTH.token, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderSettings(); }
    else showError(res.message);
  }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function deleteTypeConfirm(id, name) {
  showConfirm('ลบชนิดครุภัณฑ์', 'ยืนยันลบ "' + name + '" ?', function(){
    showLoading('กำลังลบ...');
    callAPI('deleteAssetType', AUTH.token, id).then(function(res) {
      hideLoading();
      if (res.success) { showSuccess(res.message); renderSettings(); }
      else showError(res.message);
    }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
  }, 'ลบ');
}

function openAmphoeForm(am) {
  am = am || {};
  var body = '<div class="space-y-3">';
  body += '<input type="hidden" id="amphoeId" value="' + (am.id||'') + '">';
  body += '<div><label class="form-label">ชื่อหน่วยงาน *</label><input type="text" id="amphoeName" value="' + escHtml(am.name||'') + '" class="form-input"></div>';
  body += '<div><label class="form-label">รหัสหน่วยงาน</label><input type="text" id="amphoeCode" value="' + escHtml(am.code||'') + '" class="form-input"></div>';
  body += '<div class="flex items-center gap-2"><input type="checkbox" id="amphoeActive" ' + (am.is_active!==false?'checked':'') + ' class="w-4 h-4 rounded accent-navy-700"><label for="amphoeActive" class="text-sm text-gray-700">ใช้งาน</label></div>';
  body += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>';
  footer += '<button onclick="submitAmphoe()" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึก</button>';
  openModal(am.id ? 'แก้ไขหน่วยงาน' : 'เพิ่มหน่วยงาน', body, footer);
}
function submitAmphoe() {
  var data = { id: document.getElementById('amphoeId').value, name: document.getElementById('amphoeName').value.trim(), code: document.getElementById('amphoeCode').value.trim(), is_active: document.getElementById('amphoeActive').checked };
  if (!data.name) { showError('กรุณากรอกชื่อหน่วยงาน'); return; }
  showLoading('กำลังบันทึก...');
  callAPI('saveAmphoe', AUTH.token, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderSettings(); }
    else showError(res.message);
  }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function deleteAmphoeConfirm(id, name) {
  showConfirm('ลบหน่วยงาน', 'ยืนยันลบ "' + name + '" ?', function(){
    showLoading('กำลังลบ...');
    callAPI('deleteAmphoe', AUTH.token, id).then(function(res) {
      hideLoading();
      if (res.success) { showSuccess(res.message); renderSettings(); }
      else showError(res.message);
    }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
  }, 'ลบ');
}

function openFiscalYearForm(fy) {
  fy = fy || {};
  var body = '<div class="space-y-3">';
  body += '<input type="hidden" id="fyId" value="' + (fy.id||'') + '">';
  body += '<div><label class="form-label">ปีงบประมาณ (พ.ศ.) *</label><input type="number" id="fyYear" value="' + escHtml(fy.year||'') + '" class="form-input" placeholder="เช่น 2569"></div>';
  body += '<div class="flex items-center gap-2"><input type="checkbox" id="fyActive" ' + (fy.is_active!==false?'checked':'') + ' class="w-4 h-4 rounded accent-navy-700"><label for="fyActive" class="text-sm text-gray-700">ใช้งาน</label></div>';
  body += '</div>';
  var footer = '<button onclick="closeModal()" class="btn-secondary">ยกเลิก</button>';
  footer += '<button onclick="submitFiscalYear()" class="btn-primary"><i class="fi fi-rr-disk mr-1"></i>บันทึก</button>';
  openModal(fy.id ? 'แก้ไขปีงบประมาณ' : 'เพิ่มปีงบประมาณ', body, footer);
}
function submitFiscalYear() {
  var data = { id: document.getElementById('fyId').value, year: String(document.getElementById('fyYear').value).trim(), is_active: document.getElementById('fyActive').checked };
  if (!data.year) { showError('กรุณากรอกปีงบประมาณ'); return; }
  showLoading('กำลังบันทึก...');
  callAPI('saveFiscalYear', AUTH.token, data).then(function(res) {
    hideLoading(); closeModal();
    if (res.success) { showSuccess(res.message); renderSettings(); }
    else showError(res.message);
  }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
}
function deleteFiscalYearConfirm(id, name) {
  showConfirm('ลบปีงบประมาณ', 'ยืนยันลบ ปี พ.ศ. ' + name + ' ?', function(){
    showLoading('กำลังลบ...');
    callAPI('deleteFiscalYear', AUTH.token, id).then(function(res) {
      hideLoading();
      if (res.success) { showSuccess(res.message); renderSettings(); }
      else showError(res.message);
    }).catch(function(){ hideLoading(); showError('เกิดข้อผิดพลาด'); });
  }, 'ลบ');
}

