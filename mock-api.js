// ============================================================
// Mock API — localStorage backend (works offline, no GAS needed)
// ============================================================
(function() {

  // ===== Helpers =====
  function _get(key) {
    try { return JSON.parse(localStorage.getItem('sup_mock_' + key) || 'null'); } catch(e) { return null; }
  }
  function _set(key, val) { localStorage.setItem('sup_mock_' + key, JSON.stringify(val)); }
  function _ensure(key, defaultVal) { if (_get(key) === null) _set(key, defaultVal); return _get(key); }
  var _idCounter = _get('id_counter') || 100;
  function _nextId() { _idCounter++; _set('id_counter', _idCounter); return 'id_' + _idCounter; }
  function _now() { return new Date().toISOString(); }
  function _today() { return new Date().toISOString().split('T')[0]; }
  function _auth(token) {
    var users = _get('users') || [];
    return users.find(function(u){ return u.token === token && u.token; }) || null;
  }

  // ===== Seed Data =====
  function seed() {
    if (_get('seeded')) return;

    // Users
    var users = [
      { id:'u1', username:'admin', password:'123456', name:'ผู้ดูแลระบบ', email:'admin@test.com', phone:'0811111111', role:'admin', active:true, last_login:null, avatar:'', telegram_chat_id:'', token:'tok_admin_' + Date.now() },
      { id:'u2', username:'staff', password:'123456', name:'เจ้าหน้าที่คลัง', email:'staff@test.com', phone:'0822222222', role:'staff', active:true, last_login:null, avatar:'', telegram_chat_id:'', token:'tok_staff_' + Date.now() },
      { id:'u3', username:'employee', password:'123456', name:'พนักงานตัวอย่าง', email:'emp@test.com', phone:'0833333333', role:'employee', active:true, last_login:null, avatar:'', telegram_chat_id:'', token:'tok_emp_' + Date.now() }
    ];
    _set('users', users);

    // Config
    _set('config', {
      app_name:'ระบบวัสดุสิ้นเปลือง',
      organization_name:'หน่วยงานตัวอย่าง',
      organization_address:'123 ถนนตัวอย่าง',
      organization_phone:'042-111-111',
      organization_email:'info@test.com',
      telegram_enabled:false,
      telegram_bot_token:'',
      telegram_chat_id:'',
      low_stock_threshold:5,
      app_logo:'',
      current_fiscal_year:2568
    });

    // Categories (consumable)
    var cats = [
      { id:'c1', name:'กระดาษ', is_active:true },
      { id:'c2', name:'ปากกา/ดินสอ', is_active:true },
      { id:'c3', name:'หมึกพิมพ์', is_active:true },
      { id:'c4', name:'อุปกรณ์สำนักงาน', is_active:true },
      { id:'c5', name:'อุปกรณ์ทำความสะอาด', is_active:true }
    ];
    _set('categories', cats);

    // Items (consumable)
    var items = [
      { id:'i1', item_code:'P001', name:'กระดาษ A4 80แกรม', category:'กระดาษ', unit:'รีม', current_stock:50, min_stock:10, description:'กระดาษถ่ายเอกสาร', image_file_id:'', active:true },
      { id:'i2', item_code:'P002', name:'กระดาษ A3 80แกรม', category:'กระดาษ', unit:'รีม', current_stock:8, min_stock:5, description:'', image_file_id:'', active:true },
      { id:'i3', item_code:'S001', name:'ปากกาลูกลื่น 0.5 มม.', category:'ปากกา/ดินสอ', unit:'โหล', current_stock:15, min_stock:5, description:'', image_file_id:'', active:true },
      { id:'i4', item_code:'S002', name:'ดินสอไม้ HB', category:'ปากกา/ดินสอ', unit:'โหล', current_stock:3, min_stock:5, description:'', image_file_id:'', active:true },
      { id:'i5', item_code:'I001', name:'หมึกพิมพ์ HP 205A Black', category:'หมึกพิมพ์', unit:'ตลับ', current_stock:6, min_stock:3, description:'', image_file_id:'', active:true },
      { id:'i6', item_code:'I002', name:'หมึกพิมพ์ Canon 745', category:'หมึกพิมพ์', unit:'ตลับ', current_stock:0, min_stock:2, description:'', image_file_id:'', active:true },
      { id:'i7', item_code:'O001', name:'เทปใส', category:'อุปกรณ์สำนักงาน', unit:'ม้วน', current_stock:20, min_stock:5, description:'', image_file_id:'', active:true },
      { id:'i8', item_code:'O002', name:'คลิปหนีบกระดาษ', category:'อุปกรณ์สำนักงาน', unit:'กล่อง', current_stock:12, min_stock:3, description:'', image_file_id:'', active:true },
      { id:'i9', item_code:'C001', name:'น้ำยาถูพื้น', category:'อุปกรณ์ทำความสะอาด', unit:'แกลลอน', current_stock:4, min_stock:2, description:'', image_file_id:'', active:true },
      { id:'i10', item_code:'C002', name:'ผ้าเช็ดมือม้วน', category:'อุปกรณ์ทำความสะอาด', unit:'ม้วน', current_stock:25, min_stock:10, description:'', image_file_id:'', active:true }
    ];
    _set('items', items);

    // Receives
    var receives = [
      { id:'r1', item_id:'i1', quantity:100, date:'2025-05-01', note:'ซื้อเพิ่ม', created_at:'2025-05-01T10:00:00Z' },
      { id:'r2', item_id:'i3', quantity:20, date:'2025-05-02', note:'', created_at:'2025-05-02T10:00:00Z' }
    ];
    _set('receives', receives);

    // Withdrawals
    var withdrawals = [
      { id:'w1', item_id:'i1', user_id:'u3', user_name:'พนักงานตัวอย่าง', quantity:10, date:'2025-05-10', status:'pending', note:'', purpose:'ใช้งานทั่วไป', approved_by:'', approved_at:'', withdraw_no:'WD0001', created_at:'2025-05-10T09:00:00Z' },
      { id:'w2', item_id:'i5', user_id:'u3', user_name:'พนักงานตัวอย่าง', quantity:2, date:'2025-05-12', status:'approved', note:'อนุมัติแล้ว', purpose:'เครื่องพิมพ์ชั้น 2', approved_by:'admin', approved_at:'2025-05-12T10:00:00Z', withdraw_no:'WD0002', created_at:'2025-05-12T09:00:00Z' }
    ];
    _set('withdrawals', withdrawals);

    // Transactions
    var tx = [
      { id:'t1', type:'receive', item_id:'i1', item_name:'กระดาษ A4 80แกรม', quantity:100, date:'2025-05-01', note:'ซื้อเพิ่ม', user_name:'admin', created_at:'2025-05-01T10:00:00Z' },
      { id:'t2', type:'withdraw', item_id:'i5', item_name:'หมึกพิมพ์ HP 205A Black', quantity:2, date:'2025-05-12', note:'อนุมัติแล้ว', user_name:'พนักงานตัวอย่าง', created_at:'2025-05-12T10:00:00Z' }
    ];
    _set('transactions', tx);

    // Asset Categories
    var assetCats = [
      { id:'ac1', name:'ครุภัณฑ์สำนักงาน', description:'เครื่องใช้สำนักงาน', is_active:true },
      { id:'ac2', name:'ครุภัณฑ์ยานพาหนะและขนส่ง', description:'รถยนต์ รถจักรยานยนต์', is_active:true },
      { id:'ac3', name:'ครุภัณฑ์คอมพิวเตอร์', description:'คอมพิวเตอร์และอุปกรณ์', is_active:true },
      { id:'ac4', name:'ครุภัณฑ์สิ่งก่อสร้าง', description:'อาคาร บ้านพัก', is_active:true }
    ];
    _set('asset_categories', assetCats);

    // Asset Types
    var assetTypes = [
      { id:'at1', category_id:'ac1', name:'โต๊ะทำงาน', description:'', is_active:true },
      { id:'at2', category_id:'ac1', name:'เก้าอี้สำนักงาน', description:'', is_active:true },
      { id:'at3', category_id:'ac1', name:'ตู้เอกสาร', description:'', is_active:true },
      { id:'at4', category_id:'ac1', name:'เครื่องถ่ายเอกสาร', description:'', is_active:true },
      { id:'at5', category_id:'ac1', name:'เครื่องปรับอากาศ', description:'', is_active:true },
      { id:'at6', category_id:'ac2', name:'รถยนต์', description:'', is_active:true },
      { id:'at7', category_id:'ac2', name:'รถจักรยานยนต์', description:'', is_active:true },
      { id:'at8', category_id:'ac3', name:'เครื่องคอมพิวเตอร์', description:'', is_active:true },
      { id:'at9', category_id:'ac3', name:'เครื่องพิมพ์', description:'', is_active:true },
      { id:'at10', category_id:'ac3', name:'จอภาพ', description:'', is_active:true },
      { id:'at11', category_id:'ac4', name:'อาคาร', description:'', is_active:true },
      { id:'at12', category_id:'ac4', name:'บ้านพัก', description:'', is_active:true }
    ];
    _set('asset_types', assetTypes);

    // Amphoes / Offices
    var amphoes = [
      { id:'am1', name:'สำนักงานใหญ่', code:'0001', is_active:true },
      { id:'am2', name:'สาขา 1', code:'0002', is_active:true },
      { id:'am3', name:'สาขา 2', code:'0003', is_active:true }
    ];
    _set('amphoes', amphoes);

    // Assets
    var assets = [
      { id:'a1', asset_code:'6400-001-0001', category_id:'ac1', type_id:'at4', receive_date:'2023-03-15', gfmis_number:'GF2023001', asset_number:'เลขทะเบียน 0001', description:'เครื่องถ่ายเอกสาร Ricoh MP 2555SP', brand_model:'Ricoh MP 2555SP', serial_number:'SN123456789', unit_price:45000, acquisition_method:'จัดซื้อ', location:'ชั้น 1 ห้องสำนักงาน', amphoe_id:'am1', status:'active', fiscal_year:2566, unit:'เครื่อง', quantity:1, image_url:'', qr_code:'', notes:'', created_by:'u1', created_at:'2023-03-15T10:00:00Z' },
      { id:'a2', asset_code:'6400-001-0002', category_id:'ac1', type_id:'at5', receive_date:'2023-05-20', gfmis_number:'', asset_number:'เลขทะเบียน 0002', description:'เครื่องปรับอากาศ 24000 BTU', brand_model:'Carrier 24000 BTU', serial_number:'CA987654321', unit_price:28000, acquisition_method:'จัดซื้อ', location:'ชั้น 2 ห้องประชุม', amphoe_id:'am1', status:'active', fiscal_year:2566, unit:'เครื่อง', quantity:1, image_url:'', qr_code:'', notes:'', created_by:'u1', created_at:'2023-05-20T10:00:00Z' },
      { id:'a3', asset_code:'7440-001-0001', category_id:'ac3', type_id:'at8', receive_date:'2024-01-10', gfmis_number:'GF2024001', asset_number:'เลขทะเบียน 0003', description:'คอมพิวเตอร์สำนักงาน Dell OptiPlex', brand_model:'Dell OptiPlex 7090', serial_number:'DL555666777', unit_price:32000, acquisition_method:'จัดซื้อ', location:'ชั้น 1 ห้องบัญชี', amphoe_id:'am2', status:'active', fiscal_year:2567, unit:'เครื่อง', quantity:1, image_url:'', qr_code:'', notes:'', created_by:'u1', created_at:'2024-01-10T10:00:00Z' },
      { id:'a4', asset_code:'7120-001-0001', category_id:'ac2', type_id:'at6', receive_date:'2022-08-01', gfmis_number:'', asset_number:'เลขทะเบียน 0004', description:'รถยนต์สำนักงาน Toyota Hilux Revo', brand_model:'Toyota Hilux Revo 2.4', serial_number:'MH0001234', unit_price:850000, acquisition_method:'จัดซื้อ', location:'ลานจอดรถด้านหน้า', amphoe_id:'am1', status:'active', fiscal_year:2565, unit:'คัน', quantity:1, image_url:'', qr_code:'', notes:'', created_by:'u1', created_at:'2022-08-01T10:00:00Z' },
      { id:'a5', asset_code:'6400-001-0003', category_id:'ac1', type_id:'at4', receive_date:'2021-06-15', gfmis_number:'GF2021001', asset_number:'เลขทะเบียน 0005', description:'เครื่องถ่ายเอกสาร Canon imageRUNNER', brand_model:'Canon imageRUNNER 1643i', serial_number:'CN998877665', unit_price:38000, acquisition_method:'จัดซื้อ', location:'ชั้น 2 ห้องการเงิน', amphoe_id:'am1', status:'damaged', fiscal_year:2564, unit:'เครื่อง', quantity:1, image_url:'', qr_code:'', notes:'ชำรุดรอจำหน่าย', created_by:'u1', created_at:'2021-06-15T10:00:00Z' }
    ];
    _set('assets', assets);

    // Maintenance records
    var maint = [
      { id:'m1', asset_id:'a1', maintenance_date:'2025-01-15', description:'เปลี่ยนชุดลูกกลิ้งและทำความสะอาด', contractor:'ศูนย์บริการ Ricoh บึงกาฬ', cost:3500, notes:'', recorded_by:'u1', created_at:'2025-01-15T10:00:00Z' },
      { id:'m2', asset_id:'a4', maintenance_date:'2025-02-20', description:'เปลี่ยนน้ำมันเครื่อง + ตรวจเช็คระบบเบรก', contractor:'อู่ซ่อมรถเอกชัย', cost:8500, notes:'', recorded_by:'u1', created_at:'2025-02-20T10:00:00Z' },
      { id:'m3', asset_id:'a5', maintenance_date:'2024-08-10', description:'ซ่อมแผงควบคุม ไม่สามารถสแกนได้', contractor:'ศูนย์บริการ Canon', cost:12000, notes:'รออนุมัติจำหน่าย', recorded_by:'u1', created_at:'2024-08-10T10:00:00Z' }
    ];
    _set('maintenance_records', maint);

    // Committees
    var committees = [
      { id:'cm1', fiscal_year:2568, chairman_name:'นายสมชาย ใจดี', chairman_position:'ผู้อำนวยการสำนักงาน', member1_name:'นางสาวรัตนา รักษ์ดี', member1_position:'หัวหน้ากลุ่มงานบริหาร', member2_name:'นายประเสริฐ มั่นคง', member2_position:'นักวิชาการคอมพิวเตอร์', created_by:'u1', created_at:'2025-01-05T10:00:00Z' }
    ];
    _set('committees', committees);

    // Status logs
    var statusLogs = [
      { id:'sl1', asset_id:'a5', old_status:'active', new_status:'damaged', changed_by:'u1', notes:'ชำรุดจากการใช้งานปกติ', created_at:'2024-08-15T10:00:00Z' }
    ];
    _set('status_logs', statusLogs);

    _set('seeded', true);
  }
  seed();

  // ===== Mock API =====
  window._mockAPI = {

    // --- Auth ---
    login: function(username, password, role) {
      var users = _get('users') || [];
      var u = users.find(function(x){ return x.username === username && x.password === password; });
      if (!u) return { success:false, message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
      if (u.role !== role) return { success:false, message:'บทบาทไม่ตรงกับบัญชีผู้ใช้' };
      u.token = 'tok_' + u.id + '_' + Date.now();
      u.last_login = _now();
      _set('users', users);
      return { success:true, message:'เข้าสู่ระบบสำเร็จ', token:u.token, user:{ id:u.id, username:u.username, role:u.role, name:u.name } };
    },
    logout: function(token) { return { success:true }; },
    validateSession: function(token) {
      var u = _auth(token);
      if (!u) return null;
      return { user_id:u.id, username:u.username, role:u.role, name:u.name };
    },
    forgotPassword: function(email) {
      return { success:true, message:'รหัสผ่านชั่วคราว: 123456 ( Mock )' };
    },

    // --- Dashboard ---
    getDashboardStats: function(token) {
      var items = _get('items') || [];
      var withdrawals = _get('withdrawals') || [];
      var receives = _get('receives') || [];
      var today = _today();
      var lowItems = items.filter(function(i){ return i.active !== false && i.current_stock <= i.min_stock; });
      var todayTx = (receives.filter(function(r){ return r.date === today; }).length) + (withdrawals.filter(function(w){ return w.date === today && w.status==='approved'; }).length);
      var pending = withdrawals.filter(function(w){ return w.status === 'pending'; }).length;

      // Monthly stats (last 6 months)
      var labels = [], received = [], withdrawn = [];
      for (var i=5; i>=0; i--) {
        var d = new Date(); d.setMonth(d.getMonth()-i);
        var ym = d.toISOString().slice(0,7);
        var label = d.toLocaleDateString('th-TH', {month:'short'});
        labels.push(label);
        received.push(receives.filter(function(r){ return r.date && r.date.startsWith(ym); }).reduce(function(s,r){ return s+r.quantity; },0));
        withdrawn.push(withdrawals.filter(function(w){ return w.date && w.date.startsWith(ym) && w.status==='approved'; }).reduce(function(s,w){ return s+w.quantity; },0));
      }

      // Category stats for items
      var catMap = {};
      items.forEach(function(i){ if(i.active!==false){ catMap[i.category]=(catMap[i.category]||0)+1; } });

      return {
        success:true,
        kpi:{ total_items: items.filter(function(i){ return i.active!==false; }).length, low_stock: lowItems.length, pending: pending, today_tx: todayTx },
        low_stock_items: lowItems,
        monthly_stats: { labels:labels, received:received, withdrawn:withdrawn },
        category_stats: { labels:Object.keys(catMap), data:Object.values(catMap) },
        wd_trend: { labels:labels, data:withdrawn },
        wd_by_category: { labels:Object.keys(catMap), data:Object.values(catMap).map(function(){ return 0; }) },
        monthly: labels.map(function(l, idx){ return { label:l, receive:received[idx], withdraw:withdrawn[idx] }; })
      };
    },

    // --- Items ---
    getItems: function(token) { return { success:true, data: _get('items') || [] }; },
    addItem: function(token, data) {
      var items = _get('items') || [];
      data.id = _nextId(); data.active = true; data.current_stock = data.current_stock || 0;
      items.push(data);
      _set('items', items);
      _addTx('receive', data.id, data.name, data.current_stock || 0, _today(), 'เพิ่มรายการใหม่', _auth(token).name);
      return { success:true, message:'เพิ่มรายการสำเร็จ' };
    },
    updateItem: function(token, id, data) {
      var items = _get('items') || [];
      var idx = items.findIndex(function(i){ return i.id === id; });
      if (idx === -1) return { success:false, message:'ไม่พบรายการ' };
      Object.keys(data).forEach(function(k){ items[idx][k] = data[k]; });
      _set('items', items);
      return { success:true, message:'บันทึกสำเร็จ' };
    },
    deleteItem: function(token, id) {
      var items = _get('items') || [];
      var idx = items.findIndex(function(i){ return i.id === id; });
      if (idx === -1) return { success:false, message:'ไม่พบรายการ' };
      items[idx].active = false;
      _set('items', items);
      return { success:true, message:'ลบรายการสำเร็จ' };
    },
    uploadFile: function(token, base64, mimeType, fileName) {
      var dataUrl = 'data:' + mimeType + ';base64,' + base64;
      return { success:true, file_id: dataUrl };
    },

    // --- Receives ---
    getReceives: function(token) { return { success:true, data: _get('receives') || [] }; },
    addReceive: function(token, data) {
      var recs = _get('receives') || [];
      var items = _get('items') || [];
      var item = items.find(function(i){ return i.id === data.item_id; });
      if (!item) return { success:false, message:'ไม่พบรายการวัสดุ' };
      data.id = _nextId();
      data.created_at = _now();
      recs.push(data);
      _set('receives', recs);
      item.current_stock = (item.current_stock || 0) + (data.quantity || 0);
      _set('items', items);
      _addTx('receive', item.id, item.name, data.quantity, data.date, data.note, _auth(token).name);
      return { success:true, message:'รับเข้าสำเร็จ' };
    },

    // --- Withdrawals ---
    getWithdrawals: function(token, filter) {
      var wd = _get('withdrawals') || [];
      if (filter && filter.status && filter.status !== 'all') {
        wd = wd.filter(function(w){ return w.status === filter.status; });
      }
      return { success:true, data: wd };
    },
    addWithdrawal: function(token, data) {
      var wd = _get('withdrawals') || [];
      var items = _get('items') || [];
      var item = items.find(function(i){ return i.id === data.item_id; });
      if (!item) return { success:false, message:'ไม่พบรายการวัสดุ' };
      if (item.current_stock < data.quantity) return { success:false, message:'สต็อกไม่เพียงพอ (คงเหลือ ' + item.current_stock + ')' };
      var no = 'WD' + String(wd.length + 1).padStart(4, '0');
      var u = _auth(token);
      var record = {
        id: _nextId(), item_id:data.item_id, user_id:u.id, user_name:u.name,
        quantity:data.quantity, date:_today(), status:'pending', note:data.note||'',
        purpose:data.purpose||'', approved_by:'', approved_at:'', withdraw_no:no,
        created_at:_now()
      };
      wd.push(record);
      _set('withdrawals', wd);
      return { success:true, message:'ยื่นคำขอสำเร็จ', withdraw_no:no };
    },
    approveWithdrawal: function(token, wdId, qty) {
      var wd = _get('withdrawals') || [];
      var items = _get('items') || [];
      var idx = wd.findIndex(function(w){ return w.id === wdId; });
      if (idx === -1) return { success:false, message:'ไม่พบคำขอ' };
      var w = wd[idx];
      var item = items.find(function(i){ return i.id === w.item_id; });
      if (!item) return { success:false, message:'ไม่พบรายการวัสดุ' };
      if (item.current_stock < w.quantity) return { success:false, message:'สต็อกไม่เพียงพอ' };
      item.current_stock -= w.quantity;
      w.status = 'approved'; w.approved_by = _auth(token).name; w.approved_at = _now();
      _set('withdrawals', wd);
      _set('items', items);
      _addTx('withdraw', item.id, item.name, w.quantity, w.date, w.note, w.user_name);
      return { success:true, message:'อนุมัติสำเร็จ' };
    },
    rejectWithdrawal: function(token, wdId, reason) {
      var wd = _get('withdrawals') || [];
      var idx = wd.findIndex(function(w){ return w.id === wdId; });
      if (idx === -1) return { success:false, message:'ไม่พบคำขอ' };
      wd[idx].status = 'rejected'; wd[idx].note = reason || ''; wd[idx].approved_at = _now();
      _set('withdrawals', wd);
      return { success:true, message:'ปฏิเสธคำขอแล้ว' };
    },

    // --- Transactions ---
    getTransactions: function(token) { return { success:true, data: _get('transactions') || [] }; },

    // --- Users ---
    getUsers: function(token) { return { success:true, data: _get('users') || [] }; },
    addUser: function(token, data) {
      var users = _get('users') || [];
      if (users.find(function(u){ return u.username === data.username; })) return { success:false, message:'Username นี้มีอยู่แล้ว' };
      data.id = _nextId(); data.active = true; data.last_login = null; data.avatar = ''; data.telegram_chat_id = '';
      users.push(data);
      _set('users', users);
      return { success:true, message:'เพิ่มผู้ใช้สำเร็จ' };
    },
    updateUser: function(token, id, data) {
      var users = _get('users') || [];
      var idx = users.findIndex(function(u){ return u.id === id; });
      if (idx === -1) return { success:false, message:'ไม่พบผู้ใช้' };
      Object.keys(data).forEach(function(k){ users[idx][k] = data[k]; });
      _set('users', users);
      return { success:true, message:'บันทึกสำเร็จ' };
    },
    resetUserPassword: function(token, userId) {
      var users = _get('users') || [];
      var u = users.find(function(x){ return x.id === userId; });
      if (!u) return { success:false, message:'ไม่พบผู้ใช้' };
      u.password = '123456';
      _set('users', users);
      return { success:true, message:'Reset รหัสผ่านสำเร็จ (รหัสผ่านใหม่: 123456)' };
    },
    toggleUserActive: function(token, userId) {
      var users = _get('users') || [];
      var u = users.find(function(x){ return x.id === userId; });
      if (!u) return { success:false, message:'ไม่พบผู้ใช้' };
      u.active = u.active === false ? true : false;
      _set('users', users);
      return { success:true, message:'เปลี่ยนสถานะสำเร็จ' };
    },
    changePassword: function(token, oldPass, newPass) {
      var u = _auth(token);
      if (!u) return { success:false, message:'ไม่พบผู้ใช้' };
      if (u.password !== oldPass) return { success:false, message:'รหัสผ่านเดิมไม่ถูกต้อง' };
      var users = _get('users') || [];
      var idx = users.findIndex(function(x){ return x.id === u.id; });
      users[idx].password = newPass;
      _set('users', users);
      return { success:true, message:'เปลี่ยนรหัสผ่านสำเร็จ' };
    },

    // --- Config ---
    getConfig: function(token) { return { success:true, data: _get('config') || {} }; },
    saveConfig: function(token, data) {
      _set('config', data);
      return { success:true, message:'บันทึกการตั้งค่าสำเร็จ' };
    },
    testTelegram: function(token) {
      return { success:true, message:'ส่งข้อความ Test สำเร็จ (Mock)' };
    },

    // ===== ASSET SYSTEM =====

    // --- Asset Categories ---
    getAssetCategories: function(token) { return { success:true, data: _get('asset_categories') || [] }; },
    saveAssetCategory: function(token, data) {
      var cats = _get('asset_categories') || [];
      if (data.id) {
        var idx = cats.findIndex(function(c){ return c.id === data.id; });
        if (idx > -1) cats[idx] = data;
        else cats.push(data);
      } else {
        data.id = _nextId(); cats.push(data);
      }
      _set('asset_categories', cats);
      return { success:true, message:'บันทึกสำเร็จ' };
    },
    deleteAssetCategory: function(token, id) {
      var cats = _get('asset_categories') || [];
      cats = cats.filter(function(c){ return c.id !== id; });
      _set('asset_categories', cats);
      return { success:true, message:'ลบสำเร็จ' };
    },

    // --- Asset Types ---
    getAssetTypes: function(token) { return { success:true, data: _get('asset_types') || [] }; },
    saveAssetType: function(token, data) {
      var types = _get('asset_types') || [];
      if (data.id) {
        var idx = types.findIndex(function(t){ return t.id === data.id; });
        if (idx > -1) types[idx] = data;
        else types.push(data);
      } else {
        data.id = _nextId(); types.push(data);
      }
      _set('asset_types', types);
      return { success:true, message:'บันทึกสำเร็จ' };
    },
    deleteAssetType: function(token, id) {
      var types = _get('asset_types') || [];
      types = types.filter(function(t){ return t.id !== id; });
      _set('asset_types', types);
      return { success:true, message:'ลบสำเร็จ' };
    },

    // --- Amphoes ---
    getAmphoes: function(token) { return { success:true, data: _get('amphoes') || [] }; },
    saveAmphoe: function(token, data) {
      var amps = _get('amphoes') || [];
      if (data.id) {
        var idx = amps.findIndex(function(a){ return a.id === data.id; });
        if (idx > -1) amps[idx] = data;
        else amps.push(data);
      } else {
        data.id = _nextId(); amps.push(data);
      }
      _set('amphoes', amps);
      return { success:true, message:'บันทึกสำเร็จ' };
    },
    deleteAmphoe: function(token, id) {
      var amps = _get('amphoes') || [];
      amps = amps.filter(function(a){ return a.id !== id; });
      _set('amphoes', amps);
      return { success:true, message:'ลบสำเร็จ' };
    },

    // --- Assets ---
    getAssets: function(token) { return { success:true, data: _get('assets') || [] }; },
    saveAsset: function(token, data) {
      var assets = _get('assets') || [];
      if (data.id) {
        var idx = assets.findIndex(function(a){ return a.id === data.id; });
        if (idx > -1) { assets[idx] = Object.assign({}, assets[idx], data); }
        else { data.created_by = _auth(token).id; data.created_at = _now(); assets.push(data); }
      } else {
        data.id = _nextId(); data.created_by = _auth(token).id; data.created_at = _now(); assets.push(data);
      }
      _set('assets', assets);
      return { success:true, message:'บันทึกครุภัณฑ์สำเร็จ' };
    },
    deleteAsset: function(token, id) {
      var assets = _get('assets') || [];
      assets = assets.filter(function(a){ return a.id !== id; });
      _set('assets', assets);
      return { success:true, message:'ลบครุภัณฑ์สำเร็จ' };
    },

    // --- Maintenance ---
    getAssetMaintenance: function(token) { return { success:true, data: _get('maintenance_records') || [] }; },
    saveAssetMaintenance: function(token, data) {
      var recs = _get('maintenance_records') || [];
      if (data.id) {
        var idx = recs.findIndex(function(m){ return m.id === data.id; });
        if (idx > -1) recs[idx] = data;
        else recs.push(data);
      } else {
        data.id = _nextId(); data.recorded_by = _auth(token).id; data.created_at = _now(); recs.push(data);
      }
      _set('maintenance_records', recs);
      return { success:true, message:'บันทึกสำเร็จ' };
    },
    deleteAssetMaintenance: function(token, id) {
      var recs = _get('maintenance_records') || [];
      recs = recs.filter(function(m){ return m.id !== id; });
      _set('maintenance_records', recs);
      return { success:true, message:'ลบสำเร็จ' };
    },

    // --- Status Logs ---
    getAssetStatusLogs: function(token) { return { success:true, data: _get('status_logs') || [] }; },
    saveAssetStatusLog: function(token, data) {
      var logs = _get('status_logs') || [];
      data.id = _nextId(); data.created_at = _now();
      logs.push(data);
      _set('status_logs', logs);
      // Also update asset status
      var assets = _get('assets') || [];
      var a = assets.find(function(x){ return x.id === data.asset_id; });
      if (a) { a.status = data.new_status; _set('assets', assets); }
      return { success:true, message:'บันทึกสถานะสำเร็จ' };
    },

    // --- Committees ---
    getAssetCommittees: function(token) { return { success:true, data: _get('committees') || [] }; },
    saveAssetCommittee: function(token, data) {
      var cms = _get('committees') || [];
      if (data.id) {
        var idx = cms.findIndex(function(c){ return c.id === data.id; });
        if (idx > -1) cms[idx] = data;
        else cms.push(data);
      } else {
        data.id = _nextId(); data.created_by = _auth(token).id; data.created_at = _now(); cms.push(data);
      }
      _set('committees', cms);
      return { success:true, message:'บันทึกสำเร็จ' };
    },
    deleteAssetCommittee: function(token, id) {
      var cms = _get('committees') || [];
      cms = cms.filter(function(c){ return c.id !== id; });
      _set('committees', cms);
      return { success:true, message:'ลบสำเร็จ' };
    }
  };

  function _addTx(type, itemId, itemName, qty, date, note, userName) {
    var tx = _get('transactions') || [];
    tx.push({ id:_nextId(), type:type, item_id:itemId, item_name:itemName, quantity:qty, date:date, note:note||'', user_name:userName||'', created_at:_now() });
    _set('transactions', tx);
  }

})();
