// Global State
let currentUser = null;
let currentHomeViewMode = 'list';
let companiesData = [];
let setupData = [];
let usersData = [];
let logsData = [];
let logFilterTimeout = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('etax_current_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showApp();
    } catch (e) {
      showLogin();
    }
  } else {
    showLogin();
  }
});

// -------------------------------------------------------------
// AUTHENTICATION
// -------------------------------------------------------------
function showLogin() {
  clearLoginForm();
  document.getElementById('view-login').style.display = 'flex';
  document.getElementById('app-wrapper').style.display = 'none';
}

function showApp() {
  document.getElementById('view-login').style.display = 'none';
  document.getElementById('app-wrapper').style.display = 'flex';
  document.getElementById('current-user-name').textContent = currentUser.name || currentUser.username;
  document.getElementById('current-user-role-badge').textContent = `Role: ${currentUser.role || 'User'}`;
  
  // Set role restrictions
  const isAdmin = currentUser.role === 'Admin';
  const navSetup = document.getElementById('nav-setup');
  const navCompany = document.getElementById('nav-company');
  const navUsers = document.getElementById('nav-users');

  if (!isAdmin) {
    if (navSetup) navSetup.classList.add('d-none');
    if (navCompany) navCompany.classList.add('d-none');
    if (navUsers) navUsers.classList.add('d-none');
  } else {
    if (navSetup) navSetup.classList.remove('d-none');
    if (navCompany) navCompany.classList.remove('d-none');
    if (navUsers) navUsers.classList.remove('d-none');
  }

  navigateTo('home');
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('etax_current_user', JSON.stringify(currentUser));
      showApp();
    } else {
      alert(data.message || 'Login failed');
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ' + err.message);
  }
}

function quickLogin(u, p) {
  document.getElementById('login-username').value = u;
  document.getElementById('login-password').value = p;
  handleLogin({ preventDefault: () => {} });
}

function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-success text-white' : type === 'danger' ? 'bg-danger text-white' : 'bg-primary text-white';
  const icon = type === 'success' ? 'fa-circle-check' : type === 'danger' ? 'fa-circle-xmark' : 'fa-circle-info';
  
  toast.className = `toast align-items-center ${bgClass} border-0 show shadow-lg mb-2`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="d-flex p-2 px-3 align-items-center">
      <div class="toast-body fs-6 fw-semibold">
        <i class="fa-solid ${icon} me-2"></i> ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.parentElement.parentElement.remove()"></button>
    </div>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function clearLoginForm() {
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('etax_current_user');
  showLogin();
}

// -------------------------------------------------------------
// NAVIGATION
// -------------------------------------------------------------
function navigateTo(viewId) {
  // Check permission for User role (Slide 7)
  if (currentUser && currentUser.role !== 'Admin' && (viewId === 'setup' || viewId === 'company' || viewId === 'users')) {
    alert('สิทธิ์การใช้งาน: บัญชีผู้ใช้ทั่วไปสามารถจัดการนำส่ง e-Tax ได้เท่านั้น (Admin เท่านั้นที่สามารถเข้าหน้า Setup และจัดการระบบได้)');
    return;
  }

  document.querySelectorAll('.page-view').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.etax-nav-link').forEach(el => el.classList.remove('active'));

  const targetView = document.getElementById(`view-${viewId}`);
  const targetNav = document.getElementById(`nav-${viewId}`);

  if (targetView) targetView.style.display = 'block';
  if (targetNav) targetNav.classList.add('active');

  if (viewId === 'home') loadHomeData();
  if (viewId === 'setup') loadSetupData();
  if (viewId === 'company') loadCompanyData();
  if (viewId === 'users') loadUsersData();
  if (viewId === 'logfiles') loadLogsData();
}

// -------------------------------------------------------------
// VIEW 1: HOME
// -------------------------------------------------------------
async function loadHomeData() {
  try {
    const res = await fetch('/api/home/summary');
    const data = await res.json();
    if (data.success) {
      companiesData = data.companies;
      renderHomeCompanies();
      if (data.scheduler && data.scheduler.intervalMinutes) {
        const span = document.getElementById('home-interval-mins');
        if (span) span.textContent = data.scheduler.intervalMinutes;
      }
      populateCompanyDropdowns();
    }
  } catch (err) {
    console.error('Failed to load home data', err);
  }
}

function switchHomeView(mode) {
  currentHomeViewMode = mode;
  const listBtn = document.getElementById('btn-view-list');
  const gridBtn = document.getElementById('btn-view-grid');
  const tableCont = document.getElementById('home-table-container');
  const gridCont = document.getElementById('home-grid-container');

  if (mode === 'list') {
    listBtn.classList.add('active');
    gridBtn.classList.remove('active');
    tableCont.style.display = 'block';
    gridCont.style.display = 'none';
  } else {
    listBtn.classList.remove('active');
    gridBtn.classList.add('active');
    tableCont.style.display = 'none';
    gridCont.style.display = 'flex';
  }
  renderHomeCompanies();
}

function renderHomeCompanies() {
  const tbody = document.getElementById('home-companies-tbody');
  const grid = document.getElementById('home-grid-container');
  if (!tbody || !grid) return;

  tbody.innerHTML = '';
  grid.innerHTML = '';

  companiesData.forEach((comp, idx) => {
    const stats = comp.stats || { month: 0, today: 0, success: 0, failed: 0, pending: 0 };

    // Table Row (matching Slide 9)
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-semibold text-dark">${idx + 1}. ${comp.name}</td>
      <td class="text-secondary">${comp.taxId}</td>
      <td class="text-center"><span class="pill-count pill-dark">${stats.month}</span></td>
      <td class="text-center"><span class="pill-count pill-dark">${stats.today}</span></td>
      <td class="text-center"><span class="pill-count pill-green">${stats.success}</span></td>
      <td class="text-center"><span class="pill-count pill-red">${stats.failed}</span></td>
      <td class="text-center"><span class="pill-count pill-yellow">${stats.pending}</span></td>
      <td class="text-center">
        <button class="btn btn-clear-doc" onclick="handleClearDocuments(${comp.id}, '${comp.name}')" title="ล้างเอกสารที่ค้าง">
          <i class="fa-solid fa-trash-can"></i> ล้างเอกสาร
        </button>
      </td>
    `;
    tbody.appendChild(tr);

    // Grid Card (Alternative view)
    const card = document.createElement('div');
    card.className = 'col-md-6 col-lg-3';
    card.innerHTML = `
      <div class="card h-100 border-0 shadow-sm">
        <div class="card-header bg-white border-bottom fw-bold text-truncate" title="${comp.name}">
          ${idx + 1}. ${comp.name}
        </div>
        <div class="card-body">
          <div class="text-muted small mb-3">TAX ID: <span class="fw-semibold text-dark">${comp.taxId}</span></div>
          <div class="row g-2 text-center mb-3">
            <div class="col-4">
              <div class="text-muted small">เดือนนี้</div>
              <div class="pill-count pill-dark mt-1">${stats.month}</div>
            </div>
            <div class="col-4">
              <div class="text-muted small">วันนี้</div>
              <div class="pill-count pill-dark mt-1">${stats.today}</div>
            </div>
            <div class="col-4">
              <div class="text-muted small">ค้าง</div>
              <div class="pill-count pill-yellow mt-1">${stats.pending}</div>
            </div>
            <div class="col-6 mt-2">
              <div class="text-muted small">สำเร็จ</div>
              <div class="pill-count pill-green mt-1">${stats.success}</div>
            </div>
            <div class="col-6 mt-2">
              <div class="text-muted small">ไม่สำเร็จ</div>
              <div class="pill-count pill-red mt-1">${stats.failed}</div>
            </div>
          </div>
          <button class="btn btn-clear-doc w-100 justify-content-center" onclick="handleClearDocuments(${comp.id}, '${comp.name}')">
            <i class="fa-solid fa-trash-can"></i> ล้างเอกสาร
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function triggerSendNow() {
  const btn = document.querySelector('.btn-send-now');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> กำลังนำส่งข้อมูล...';
  }

  try {
    const res = await fetch('/api/process/send-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (data.success) {
      const resData = data.results || {};
      showToast(`นำส่งข้อมูลเสร็จสิ้น: สำเร็จ ${resData.successCount || 0} ไฟล์, ไม่สำเร็จ ${resData.failedCount || 0} ไฟล์`, 'success');
      alert(`นำส่งข้อมูลเสร็จสิ้น!\n• จำนวนที่ตรวจพบ: ${resData.processedCount || 0} ไฟล์\n• สำเร็จ: ${resData.successCount || 0} ไฟล์\n• ไม่สำเร็จ: ${resData.failedCount || 0} ไฟล์`);
      loadHomeData();
    } else {
      alert('เกิดข้อผิดพลาดในการนำส่งข้อมูล: ' + data.message);
    }
  } catch (err) {
    alert('เชื่อมต่อเซิร์ฟเวอร์ผิดพลาด: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> นำส่งข้อมูลทันที';
    }
  }
}

async function handleClearDocuments(companyId, companyName) {
  if (!confirm(`คุณต้องการล้างรายการเอกสารค้างของ "${companyName}" หรือไม่?`)) return;

  try {
    const res = await fetch(`/api/home/clear/${companyId}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      alert(data.message);
      loadHomeData();
    } else {
      alert('ไม่สามารถล้างเอกสารได้: ' + data.message);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}

// -------------------------------------------------------------
// VIEW 2: SETUP (Slide 10)
// -------------------------------------------------------------
async function loadSetupData() {
  try {
    const res = await fetch('/api/setup');
    const data = await res.json();
    if (data.success) {
      setupData = data.setup;
      renderSetupTable();
    }
  } catch (err) {
    console.error('Failed to load setup data', err);
  }
}

function renderSetupTable() {
  const tbody = document.getElementById('setup-table-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  setupData.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-bold">${idx + 1}</td>
      <td>${item.descTH || item.descEN || '-'}</td>
      <td class="font-monospace text-primary">${item.name}</td>
      <td class="font-monospace text-dark">${item.value}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-secondary rounded-pill px-3" onclick="editSetupItem('${item.name}')">
          แก้ไข
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function editSetupItem(name) {
  const item = setupData.find(s => s.name === name);
  if (!item) return;

  document.getElementById('setup-name').value = item.name;
  document.getElementById('setup-desc-th').value = item.descTH || '';
  document.getElementById('setup-desc-en').value = item.descEN || '';
  document.getElementById('setup-val').value = item.value;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleSaveSetup(event) {
  event.preventDefault();
  const name = document.getElementById('setup-name').value.trim();
  const descTH = document.getElementById('setup-desc-th').value.trim();
  const descEN = document.getElementById('setup-desc-en').value.trim();
  const value = document.getElementById('setup-val').value.trim();

  try {
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, descTH, descEN, value })
    });
    const data = await res.json();
    if (data.success) {
      showToast('บันทึกการตั้งค่าเรียบร้อยแล้ว', 'success');
      alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
      loadSetupData();
      // Clear form
      document.getElementById('form-setup').reset();
    } else {
      alert('ไม่สามารถบันทึกได้: ' + data.message);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}

// -------------------------------------------------------------
// VIEW 3: COMPANY (Slide 11)
// -------------------------------------------------------------
async function loadCompanyData() {
  try {
    const res = await fetch('/api/companies');
    const data = await res.json();
    if (data.success) {
      companiesData = data.companies;
      renderCompanyTable();
    }
  } catch (err) {
    console.error('Failed to load companies data', err);
  }
}

function renderCompanyTable() {
  const tbody = document.getElementById('company-table-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  companiesData.forEach((comp, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-bold">${idx + 1}</td>
      <td class="fw-semibold">${comp.name}</td>
      <td class="font-monospace">${comp.taxId}</td>
      <td class="font-monospace text-muted">${comp.folder}</td>
      <td class="text-center">
        <div class="d-flex justify-content-center gap-1">
          <button class="btn btn-sm btn-secondary rounded px-2" onclick="editCompany(${comp.id})">แก้ไข</button>
          <button class="btn btn-sm btn-warning text-dark rounded px-2" onclick="deleteCompany(${comp.id}, '${comp.name}')">ลบ</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function resetCompanyForm() {
  document.getElementById('company-edit-id').value = '';
  document.getElementById('comp-name').value = '';
  document.getElementById('comp-folder').value = '';
  document.getElementById('comp-mode').value = 'ส่งไฟล์คู่ TXT และ PDF';
  document.getElementById('comp-taxid').value = '';
  document.getElementById('comp-branch').value = '00000';
  document.getElementById('comp-phone').value = '';
  document.getElementById('comp-authcode').value = '';
  document.getElementById('comp-apikey').value = '';
}

function editCompany(id) {
  const comp = companiesData.find(c => c.id === id);
  if (!comp) return;

  document.getElementById('company-edit-id').value = comp.id;
  document.getElementById('comp-name').value = comp.name;
  document.getElementById('comp-folder').value = comp.folder;
  document.getElementById('comp-mode').value = comp.mode || 'ส่งไฟล์คู่ TXT และ PDF';
  document.getElementById('comp-taxid').value = comp.taxId;
  document.getElementById('comp-branch').value = comp.branch || '00000';
  document.getElementById('comp-phone').value = comp.phone || '';
  document.getElementById('comp-authcode').value = comp.authCode || '';
  document.getElementById('comp-apikey').value = comp.apiKey || '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleSaveCompany(event) {
  event.preventDefault();
  const id = document.getElementById('company-edit-id').value;
  const payload = {
    name: document.getElementById('comp-name').value.trim(),
    folder: document.getElementById('comp-folder').value.trim(),
    mode: document.getElementById('comp-mode').value,
    taxId: document.getElementById('comp-taxid').value.trim(),
    branch: document.getElementById('comp-branch').value.trim(),
    phone: document.getElementById('comp-phone').value.trim(),
    authCode: document.getElementById('comp-authcode').value.trim(),
    apiKey: document.getElementById('comp-apikey').value.trim()
  };

  try {
    const url = id ? `/api/companies/${id}` : '/api/companies';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      alert(data.message);
      resetCompanyForm();
      loadCompanyData();
    } else {
      alert('ไม่สามารถบันทึกได้: ' + data.message);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}

async function deleteCompany(id, name) {
  if (!confirm(`คุณแน่ใจว่าต้องการลบข้อมูลบริษัท "${name}" หรือไม่?`)) return;

  try {
    const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      loadCompanyData();
    } else {
      alert('ไม่สามารถลบได้: ' + data.message);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}

// -------------------------------------------------------------
// VIEW 4: USERS (Slide 12)
// -------------------------------------------------------------
async function loadUsersData() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    if (data.success) {
      usersData = data.users;
      renderUsersList();
      if (usersData.length > 0) {
        selectUserForEdit(usersData[0].id);
      }
    }
  } catch (err) {
    console.error('Failed to load users data', err);
  }
}

function renderUsersList() {
  const container = document.getElementById('users-list-container');
  if (!container) return;
  container.innerHTML = '';

  usersData.forEach((u, idx) => {
    const item = document.createElement('div');
    item.className = 'user-list-group-item';
    item.id = `user-item-${u.id}`;
    item.innerHTML = `
      <div onclick="selectUserForEdit(${u.id})" class="flex-grow-1 d-flex align-items-center gap-2">
        <i class="fa-solid fa-pen-to-square text-secondary"></i>
        <span class="fw-semibold">${idx + 1}. ${u.name}</span>
        <span class="badge ${u.role === 'Admin' ? 'bg-primary' : 'bg-secondary'} ms-auto small">${u.role}</span>
      </div>
      <button class="btn btn-link text-danger p-0 ms-2" onclick="deleteUser(${u.id}, '${u.name}')" title="ลบผู้ใช้">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    `;
    container.appendChild(item);
  });
}

function createNewUser() {
  document.querySelectorAll('.user-list-group-item').forEach(el => el.classList.remove('active'));
  document.getElementById('user-edit-id').value = '';
  document.getElementById('user-role').value = 'User';
  document.getElementById('user-fullname').value = '';
  document.getElementById('user-username').value = '';
  document.getElementById('user-password').value = '';
  document.getElementById('user-email').value = '';
  document.getElementById('user-avatar-preview').src = '/assets/avatar-user.svg';
  document.getElementById('user-fullname').focus();
}

function selectUserForEdit(id) {
  const user = usersData.find(u => u.id === id);
  if (!user) return;

  document.querySelectorAll('.user-list-group-item').forEach(el => el.classList.remove('active'));
  const activeItem = document.getElementById(`user-item-${id}`);
  if (activeItem) activeItem.classList.add('active');

  document.getElementById('user-edit-id').value = user.id;
  document.getElementById('user-role').value = user.role;
  document.getElementById('user-fullname').value = user.name;
  document.getElementById('user-username').value = user.username;
  document.getElementById('user-password').value = '';
  document.getElementById('user-email').value = user.email || '';
  document.getElementById('user-avatar-preview').src = user.image || '/assets/avatar-user.svg';
}

function cancelUserEdit() {
  if (usersData.length > 0) {
    selectUserForEdit(usersData[0].id);
  } else {
    createNewUser();
  }
}

function previewAvatar(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('user-avatar-preview').src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

async function handleSaveUser(event) {
  event.preventDefault();
  const id = document.getElementById('user-edit-id').value;
  const payload = {
    role: document.getElementById('user-role').value,
    name: document.getElementById('user-fullname').value.trim(),
    username: document.getElementById('user-username').value.trim(),
    email: document.getElementById('user-email').value.trim(),
    image: document.getElementById('user-avatar-preview').src
  };

  const newPass = document.getElementById('user-password').value;
  if (newPass) payload.password = newPass;

  if (!id && !payload.password) {
    alert('กรุณาระบุ Password สำหรับผู้ใช้ใหม่');
    return;
  }

  try {
    const url = id ? `/api/users/${id}` : '/api/users';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      alert(data.message);
      loadUsersData();
    } else {
      alert('ไม่สามารถบันทึกได้: ' + data.message);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}

async function deleteUser(id, name) {
  if (!confirm(`คุณแน่ใจว่าต้องการลบผู้ใช้ "${name}" หรือไม่?`)) return;

  try {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      alert(data.message);
      loadUsersData();
    } else {
      alert('ไม่สามารถลบได้: ' + data.message);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}

// -------------------------------------------------------------
// VIEW 5: LOGFILES (Slide 13)
// -------------------------------------------------------------
async function loadLogsData() {
  const compId = document.getElementById('log-filter-company').value;
  const status = document.getElementById('log-filter-status').value;
  const dateFrom = document.getElementById('log-filter-date-from').value;
  const dateTo = document.getElementById('log-filter-date-to').value;
  const search = document.getElementById('log-search-input').value.trim();
  const limit = document.getElementById('log-page-limit').value;

  const params = new URLSearchParams({
    companyId: compId || 'all',
    status: status || 'ทั้งหมด',
    dateFrom: dateFrom || '',
    dateTo: dateTo || '',
    search: search || '',
    limit: limit || 10
  });

  try {
    const res = await fetch(`/api/logs?${params.toString()}`);
    const data = await res.json();
    if (data.success) {
      logsData = data.logs;
      renderLogsTable(data.total);
      updateLogFilterSummary(compId, status, dateFrom, dateTo);
    }
  } catch (err) {
    console.error('Failed to load logs', err);
  }
}

function updateLogFilterSummary(compId, status, from, to) {
  const summaryEl = document.getElementById('log-filter-summary');
  if (!summaryEl) return;

  let compName = 'ทั้งหมด';
  if (compId && compId !== 'all') {
    const found = companiesData.find(c => c.id === parseInt(compId, 10));
    if (found) compName = found.name;
  } else {
    // default presentation text
    compName = 'บริษัท เฟล็กซ์ ซอฟท์แวร์(ประเทศไทย) จำกัด';
  }

  summaryEl.textContent = `${compName} : วันที่ส่งเอกสาร ${from || '2025-08-27'} ถึง ${to || '2025-08-27'} สถานะ : ${status || 'ทั้งหมด'}`;
}

function renderLogsTable(total) {
  const tbody = document.getElementById('log-table-tbody');
  const infoEl = document.getElementById('log-pagination-info');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (logsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">ไม่พบข้อมูลตามเงื่อนไขที่กำหนด</td></tr>`;
    if (infoEl) infoEl.textContent = 'Showing 0 to 0 of 0 entries';
    return;
  }

  logsData.forEach((log, idx) => {
    const isSuccess = log.status === 'สร้างเอกสารสำเร็จ';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-bold">${idx + 1}</td>
      <td class="font-monospace fw-semibold">${log.docNo}</td>
      <td class="font-monospace text-success fw-bold">${log.serviceCode}</td>
      <td class="text-muted">${log.sentAt}</td>
      <td class="text-center">
        <span class="${isSuccess ? 'badge-status-success' : 'badge-status-failed'}">
          ${log.status}
        </span>
      </td>
      <td class="text-center">
        ${isSuccess ? '-' : `
          <button class="btn-info-detail" onclick="openErrorDetailModal(${log.id})" title="ดูรายละเอียด Error">
            <i class="fa-solid fa-circle-info"></i>
          </button>
        `}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (infoEl) {
    infoEl.textContent = `Showing 1 to ${logsData.length} of ${total} entries`;
  }
}

function debounceLogSearch() {
  clearTimeout(logFilterTimeout);
  logFilterTimeout = setTimeout(() => {
    loadLogsData();
  }, 300);
}

function applyLogFilter() {
  loadLogsData();
}

function openErrorDetailModal(logId) {
  const log = logsData.find(l => l.id === logId);
  if (!log) return;

  document.getElementById('modal-err-docno').textContent = log.docNo;
  document.getElementById('modal-err-service').textContent = log.serviceCode;
  document.getElementById('modal-err-time').textContent = log.sentAt;
  document.getElementById('modal-err-message').textContent = log.detail || log.errorDescription || 'ข้อผิดพลาดไม่ทราบสาเหตุ';

  // Suggest solution according to Slide 14
  let solution = 'ตรวจสอบและแก้ไขข้อมูลในระบบ Autocount ให้ถูกต้อง แล้วทำการส่งออกใหม่อีกครั้ง';
  if (log.detail && log.detail.includes('Format (H21,B10)')) {
    solution = 'แก้ไขเบอร์โทรศัพท์ในหน้า Customer / Debtor Maintenance ใน Autocount ให้มีรูปแบบเครื่องหมาย + หรือ - และความยาวไม่เกิน 30 หลัก';
  } else if (log.detail && log.detail.includes('eTax Reason')) {
    solution = 'ในหน้าบันทึกเอกสารเพิ่มหนี้/ลดหนี้ (DN / CN) ของ Autocount ให้ระบุรหัสเหตุผล eTax Reason ตามประกาศกรมสรรพากร';
  } else if (log.detail && log.detail.includes('Registration Type')) {
    solution = 'กำหนดประเภทผู้เสียภาษี (Registration Type: TXID/NIDN) และรหัสประเทศ (Country Code: เช่น TH) ของคู่ค้าใน Autocount';
  } else if (log.detail && log.detail.includes('Debtor Maintenance')) {
    solution = 'ระบุ Email ของลูกค้าในหน้า Debtor Maintenance ในระบบ Autocount ให้ถูกต้อง';
  }

  document.getElementById('modal-err-solution').textContent = solution;

  const modal = new bootstrap.Modal(document.getElementById('modal-error-detail'));
  modal.show();
}

// -------------------------------------------------------------
// HELPER MODALS & TEST GENERATOR
// -------------------------------------------------------------
function openArchitectureModal() {
  const modal = new bootstrap.Modal(document.getElementById('modal-architecture'));
  modal.show();
}

function populateCompanyDropdowns() {
  const testSelect = document.getElementById('test-comp-select');
  const logSelect = document.getElementById('log-filter-company');

  if (testSelect) {
    testSelect.innerHTML = '';
    companiesData.forEach(comp => {
      const opt = document.createElement('option');
      opt.value = comp.id;
      opt.textContent = `${comp.name} (${comp.folder})`;
      testSelect.appendChild(opt);
    });
  }

  if (logSelect) {
    logSelect.innerHTML = '<option value="all">ทั้งหมด</option>';
    companiesData.forEach(comp => {
      const opt = document.createElement('option');
      opt.value = comp.id;
      opt.textContent = comp.name;
      logSelect.appendChild(opt);
    });
  }
}

function openTestModal() {
  populateCompanyDropdowns();
  const alertEl = document.getElementById('test-result-alert');
  if (alertEl) alertEl.classList.add('d-none');
  const modal = new bootstrap.Modal(document.getElementById('modal-test-inbound'));
  modal.show();
}

async function executeGenerateSample() {
  const compId = document.getElementById('test-comp-select').value;
  const type = document.querySelector('input[name="testType"]:checked').value;
  const alertEl = document.getElementById('test-result-alert');

  try {
    const res = await fetch('/api/inbound/generate-sample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: compId, type })
    });
    const data = await res.json();
    if (data.success) {
      alertEl.textContent = `${data.message} - ไฟล์ถูกบันทึกลงในโฟลเดอร์ Inbound แล้ว สถานะเอกสารค้างเพิ่มขึ้นแล้ว!`;
      alertEl.classList.remove('d-none', 'alert-danger');
      alertEl.classList.add('alert-success');
      loadHomeData();
    } else {
      alertEl.textContent = 'เกิดข้อผิดพลาด: ' + data.message;
      alertEl.classList.remove('d-none', 'alert-success');
      alertEl.classList.add('alert-danger');
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}
