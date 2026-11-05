const API = '/api';

// ---------- Global ripple effect on all buttons ----------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-primary, .btn-secondary');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  ripple.className = 'ripple-el';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
});

// ---------- Auth ----------
let isSetupMode = false;

async function checkAuth() {
  const statusRes = await fetch(`${API}/auth/setup/status`);
  const status = await statusRes.json();

  if (!status.setup_complete) {
    isSetupMode = true;
    showAuthScreen();
    return;
  }

  const meRes = await fetch(`${API}/auth/me`);
  if (meRes.ok) {
    const me = await meRes.json();
    showApp(me);
  } else {
    isSetupMode = false;
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('auth-title').textContent = isSetupMode ? t('create_admin_account') : t('sign_in');
  document.getElementById('auth-subtitle').textContent = isSetupMode ? t('setup_subtitle') : t('enter_credentials');
  document.getElementById('auth-fullname-field').style.display = isSetupMode ? 'flex' : 'none';
  document.getElementById('auth-fullname').required = isSetupMode;
  document.getElementById('auth-password').autocomplete = isSetupMode ? 'new-password' : 'current-password';
  document.getElementById('auth-submit').textContent = isSetupMode ? t('create_and_sign_in') : t('sign_in_btn');
  document.getElementById('auth-username').focus();
}

function showApp(user) {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  document.getElementById('current-user').innerHTML = `<strong>${user.full_name}</strong><br><small>${user.username} · ${user.role}</small>`;
  loadProjects().then(loadPlots);
  loadOverview();
  initOverviewScene();
  attachTiltEffect();
}

// ---------- 3D: Overview hero scene ----------
let overviewSceneStarted = false;
function initOverviewScene() {
  if (overviewSceneStarted || typeof THREE === 'undefined') return;
  overviewSceneStarted = true;
  const canvas = document.getElementById('overview-3d-canvas');
  if (!canvas) return;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0E2620, 0.058);

  const camera = new THREE.PerspectiveCamera(42, canvas.clientWidth / (canvas.clientHeight || 1), 0.1, 100);
  camera.position.set(7, 5.5, 10);

  scene.add(new THREE.AmbientLight(0x3d5148, 0.55));
  const key = new THREE.DirectionalLight(0xE0BB74, 1.3);
  key.position.set(6, 9, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x2A5C4C, 0.8);
  rim.position.set(-6, 3, -4);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);

  const groundGeo = new THREE.PlaneGeometry(40, 40);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0C211B, roughness: 0.85 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const grid = new THREE.GridHelper(40, 32, 0x6E5223, 0x1C4137);
  grid.material.transparent = true;
  grid.material.opacity = 0.3;
  group.add(grid);

  const cols = 11, rows = 7, spacing = 1.15;
  const parcels = [];
  const brassColor = new THREE.Color(0xE0BB74);
  const sageColor = new THREE.Color(0x6FA085);

  for (let x = 0; x < cols; x++) {
    for (let z = 0; z < rows; z++) {
      if (Math.random() < 0.15) continue;
      const w = 0.75 + Math.random() * 0.2;
      const d = 0.75 + Math.random() * 0.2;
      const isHighlighted = Math.random() < 0.14;
      const px = (x - cols / 2) * spacing;
      const pz = (z - rows / 2) * spacing;

      const fillMat = new THREE.MeshBasicMaterial({
        color: isHighlighted ? brassColor : 0x143028, transparent: true,
        opacity: isHighlighted ? 0.2 : 0.45
      });
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, d), fillMat);
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(px, 0.01, pz);
      group.add(fill);

      const edges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, d));
      const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: isHighlighted ? brassColor : sageColor, transparent: true,
        opacity: isHighlighted ? 0.9 : 0.35
      }));
      outline.rotation.x = -Math.PI / 2;
      outline.position.set(px, 0.02, pz);
      group.add(outline);

      if (isHighlighted) parcels.push({ fill, outline, phase: Math.random() * Math.PI * 2 });
    }
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  const radius = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
  const baseAngle = Math.atan2(camera.position.z, camera.position.x);

  function animate() {
    const t = clock.getElapsedTime();
    const angle = baseAngle + t * 0.035;
    camera.position.x = Math.cos(angle) * radius;
    camera.position.z = Math.sin(angle) * radius;
    camera.lookAt(0, 0, 0);

    parcels.forEach(p => {
      const pulse = Math.sin(t * 1.1 + p.phase) * 0.5 + 0.5;
      p.fill.material.opacity = 0.12 + pulse * 0.16;
      p.outline.material.opacity = 0.55 + pulse * 0.4;
    });

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

// ---------- 3D: Fingerprint scanner ----------
let fingerprintScene = null;
function initFingerprintScene() {
  if (fingerprintScene || typeof THREE === 'undefined') return;
  const canvas = document.getElementById('fingerprint-3d-canvas');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 3.2, 6.5);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.PointLight(0xC39A5C, 1.4, 20);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0x1F3F37, 0.7, 20);
  rim.position.set(-4, -2, 3);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);

  // Build the fingerprint as concentric, slightly organic 3D ridge rings
  // (an Archimedean-spiral whorl reads unmistakably as a fingerprint once lit and tilted in 3D)
  const ringCount = 9;
  const ridgeMeshes = [];
  const idleColor = new THREE.Color(0x8A9187);

  for (let i = 0; i < ringCount; i++) {
    const radius = 0.35 + i * 0.19;
    const tubeRadius = 0.028;
    // Slight ellipse + organic waviness via a custom curve rather than a perfect torus
    const points = [];
    const segments = 80;
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const wobble = Math.sin(theta * 3 + i) * 0.035 + Math.sin(theta * 5 - i * 1.3) * 0.02;
      const rx = (radius + wobble) * 1.08;
      const ry = (radius + wobble) * 0.92;
      points.push(new THREE.Vector3(Math.cos(theta) * rx, Math.sin(theta) * ry, 0));
    }
    const curve = new THREE.CatmullRomCurve3(points, true);
    const geo = new THREE.TubeGeometry(curve, 100, tubeRadius, 6, true);
    const mat = new THREE.MeshStandardMaterial({
      color: idleColor, roughness: 0.5, metalness: 0.3,
      emissive: idleColor, emissiveIntensity: 0.15
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.baseColor = idleColor.clone();
    mesh.userData.ringIndex = i;
    group.add(mesh);
    ridgeMeshes.push(mesh);
  }

  // Core dot
  const coreMat = new THREE.MeshStandardMaterial({ color: idleColor, emissive: idleColor, emissiveIntensity: 0.2 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), coreMat);
  group.add(core);

  group.rotation.x = -0.45;

  // Scan beam - a thin glowing plane that sweeps through the fingerprint
  const beamGeo = new THREE.PlaneGeometry(2.4, 0.05);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xC39A5C, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.x = -Math.PI / 2 + 0.45;
  group.add(beam);

  // Expanding success ring (hidden until triggered)
  const successRingGeo = new THREE.TorusGeometry(0.4, 0.015, 8, 60);
  const successRingMat = new THREE.MeshBasicMaterial({ color: 0x5B7A63, transparent: true, opacity: 0 });
  const successRing = new THREE.Mesh(successRingGeo, successRingMat);
  group.add(successRing);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let state = 'idle'; // idle | scanning | success
  let stateStartTime = 0;
  const clock = new THREE.Clock();

  const goldColor = new THREE.Color(0xC39A5C);
  const greenColor = new THREE.Color(0x5B7A63);

  function animate() {
    const t = clock.getElapsedTime();
    group.rotation.z = Math.sin(t * 0.3) * 0.08;

    if (state === 'idle') {
      ridgeMeshes.forEach(m => {
        m.material.color.copy(idleColor);
        m.material.emissive.copy(idleColor);
        m.material.emissiveIntensity = 0.12 + Math.sin(t * 0.6) * 0.03;
      });
      coreMat.color.copy(idleColor);
      coreMat.emissiveIntensity = 0.15;
      beamMat.opacity = 0;
      successRingMat.opacity = 0;
      group.rotation.y = Math.sin(t * 0.25) * 0.25;
    }

    if (state === 'scanning') {
      const elapsed = t - stateStartTime;
      ridgeMeshes.forEach((m, i) => {
        const wave = Math.sin(elapsed * 3 - i * 0.4) * 0.5 + 0.5;
        m.material.color.copy(idleColor).lerp(goldColor, 0.6 + wave * 0.4);
        m.material.emissive.copy(goldColor);
        m.material.emissiveIntensity = 0.3 + wave * 0.5;
      });
      coreMat.color.copy(goldColor);
      coreMat.emissiveIntensity = 0.6 + Math.sin(elapsed * 6) * 0.3;

      // Sweep beam up and down through the print
      const sweepCycle = (elapsed % 1.3) / 1.3;
      beam.position.y = -0.9 + sweepCycle * 1.8;
      beamMat.opacity = Math.sin(sweepCycle * Math.PI) * 0.85;

      group.rotation.y = Math.sin(t * 0.6) * 0.35;
    }

    if (state === 'success') {
      const elapsed = t - stateStartTime;
      ridgeMeshes.forEach(m => {
        m.material.color.copy(greenColor);
        m.material.emissive.copy(greenColor);
        m.material.emissiveIntensity = 0.5;
      });
      coreMat.color.copy(greenColor);
      coreMat.emissiveIntensity = 0.6;
      beamMat.opacity = 0;

      // Expanding ring burst
      const ringProgress = Math.min(elapsed / 0.9, 1);
      successRing.scale.setScalar(1 + ringProgress * 2.5);
      successRingMat.opacity = (1 - ringProgress) * 0.8;

      group.rotation.y += 0.008;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  fingerprintScene = {
    setState(newState) {
      state = newState;
      stateStartTime = clock.getElapsedTime();
    }
  };
}

function setFingerprintState(state) {
  if (!fingerprintScene) return;
  fingerprintScene.setState(state);
}
function animateCount(el, target) {
  const duration = 900;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function loadOverview() {
  try {
    const [projects, plots, customers, outstanding] = await Promise.all([
      api('/projects'), api('/plots'), api('/customers'), api('/reports/outstanding')
    ]);

    animateCount(document.getElementById('stat-projects'), projects.length);
    animateCount(document.getElementById('stat-plots'), plots.length);
    animateCount(document.getElementById('stat-customers'), customers.length);
    animateCount(document.getElementById('stat-overdue'), outstanding.filter(o => o.overdue_count > 0).length);

    const counts = {};
    plots.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    const breakdown = document.getElementById('status-breakdown');
    breakdown.innerHTML = Object.entries(counts).map(([status, count]) => `
      <div class="status-chip">
        <div class="chip-count">${count}</div>
        <div class="chip-label">${status.replace('_', ' ')}</div>
        <div class="chip-bar"></div>
      </div>`).join('') || '<p class="hint">No plots yet.</p>';
  } catch (e) {
    console.error(e);
  }
}

// ---------- 3D tilt effect on stat cards ----------
function attachTiltEffect() {
  document.querySelectorAll('.tilt-card').forEach(card => {
    if (card.dataset.tiltBound) return;
    card.dataset.tiltBound = '1';
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty('--ry', `${x * 12}deg`);
      card.style.setProperty('--rx', `${-y * 12}deg`);
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--rx', '0deg');
    });
  });
}

document.getElementById('auth-toggle-pw').addEventListener('click', (e) => {
  const input = document.getElementById('auth-password');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  e.currentTarget.textContent = t(show ? 'hide_password' : 'show_password');
  e.currentTarget.setAttribute('data-i18n', show ? 'hide_password' : 'show_password');
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errDiv = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit');
  errDiv.style.display = 'none';
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const endpoint = isSetupMode ? '/auth/setup' : '/auth/login';
  const body = isSetupMode
    ? { username, password, full_name: document.getElementById('auth-fullname').value.trim() }
    : { username, password };

  submitBtn.disabled = true;
  submitBtn.textContent = t('signing_in');
  let user = null;
  try {
    let res;
    try {
      res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (netErr) {
      throw new Error('Cannot reach the server. Check your connection and try again.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Sign in failed. Please try again.');
    user = data;
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.style.display = 'block';
    document.getElementById('auth-password').select();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = isSetupMode ? t('create_and_sign_in') : t('sign_in_btn');
  }
  if (user) {
    document.getElementById('auth-password').value = '';
    showApp(user);
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch(`${API}/auth/logout`, { method: 'POST' });
  location.reload();
});


// ---------- Navigation ----------
const titleKeys = {
  overview: 'nav_overview',
  projects: 'nav_projects',
  customers: 'nav_customers',
  sales: 'nav_sales',
  recovery: 'nav_recovery',
  transfer: 'transfer_ownership_title',
  'noc-resale': 'nav_noc',
  accounting: 'nav_accounting',
  brokers: 'nav_brokers',
  landlords: 'nav_landlords',
  team: 'team_accounts',
  tools: 'nav_tools',
  migration: 'nav_migration'
};

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    document.getElementById(`view-${view}`).classList.add('active');
    document.getElementById('view-title').textContent = t(titleKeys[view]);
    if (view === 'overview') loadOverview();
    if (view === 'recovery') loadOutstanding();
    if (view === 'customers') loadCustomers();
    if (view === 'sales' || view === 'transfer' || view === 'noc-resale' || view === 'tools') loadCustomerOptions();
    if (view === 'accounting') loadAccounting();
    if (view === 'brokers') loadBrokers();
    if (view === 'landlords') loadLandlords();
    if (view === 'team') loadUsers();
    if (view === 'migration') loadMigrationReport();
    if (view === 'tools') setTimeout(initFingerprintScene, 50);
  });
});

// ---------- Helpers ----------
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function statusPillClass(status) {
  return `status-pill status-${status}`;
}

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-backdrop').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modal-backdrop').style.display = 'none';
}
document.getElementById('modal-backdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modal-backdrop') closeModal();
});

// ---------- PROJECTS ----------
let selectedProjectId = null;

async function loadProjects() {
  const projects = await api('/projects');
  const list = document.getElementById('projects-list');
  const filterSelect = document.getElementById('filter-project');
  list.innerHTML = '';
  filterSelect.innerHTML = '<option value="">All projects</option>';

  projects.forEach(p => {
    const item = document.createElement('div');
    item.className = 'list-item' + (p.project_id === selectedProjectId ? ' selected' : '');
    item.innerHTML = `${p.project_name}<small>${p.location || ''}</small>`;
    item.addEventListener('click', () => {
      selectedProjectId = p.project_id;
      loadProjects();
      loadPlots();
    });
    list.appendChild(item);

    const opt = document.createElement('option');
    opt.value = p.project_id;
    opt.textContent = p.project_name;
    filterSelect.appendChild(opt);
  });

  if (!selectedProjectId && projects.length) selectedProjectId = projects[0].project_id;
  filterSelect.value = selectedProjectId || '';
}

document.getElementById('filter-project').addEventListener('change', (e) => {
  selectedProjectId = e.target.value || null;
  loadPlots();
});

document.getElementById('new-project-btn').addEventListener('click', () => {
  openModal(`
    <h3>New Project</h3>
    <div class="form-grid">
      <label>Project Name<input type="text" id="m-project-name"></label>
      <label>Location<input type="text" id="m-project-location"></label>
      <label>Description<textarea id="m-project-desc" rows="2"></textarea></label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="m-project-save">Create</button>
    </div>
  `);
  document.getElementById('m-project-save').addEventListener('click', async () => {
    const project_name = document.getElementById('m-project-name').value.trim();
    if (!project_name) return;
    await api('/projects', {
      method: 'POST',
      body: JSON.stringify({
        project_name,
        location: document.getElementById('m-project-location').value,
        description: document.getElementById('m-project-desc').value
      })
    });
    closeModal();
    loadProjects();
  });
});

// ---------- PLOTS ----------
async function loadPlots() {
  const qs = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
  const plots = await api(`/plots${qs}`);
  const tbody = document.querySelector('#plots-table tbody');
  tbody.innerHTML = '';
  plots.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="code-stamp">${p.plot_code}</span></td>
      <td>${p.block_name || '-'}</td>
      <td>${p.type_name || '-'}</td>
      <td>${p.marla || '-'}</td>
      <td>${p.base_price ? Number(p.base_price).toLocaleString() : '-'}</td>
      <td><span class="${statusPillClass(p.status)}">${t('status_' + p.status)}</span></td>
      <td><button class="btn-secondary" data-plot="${p.plot_code}">View</button></td>
    `;
    tr.querySelector('button').addEventListener('click', () => lookupPlot(p.plot_code));
    tbody.appendChild(tr);
  });
}

document.getElementById('new-plot-btn').addEventListener('click', async () => {
  if (!selectedProjectId) return alert('Select or create a project first.');
  const types = await api('/plot-types');
  const typeOptions = types.map(t => `<option value="${t.plot_type_id}">${t.type_name}</option>`).join('');
  openModal(`
    <h3>Add Plot</h3>
    <div class="form-grid">
      <label>Plot Code (permanent)<input type="text" id="m-plot-code"></label>
      <label>Plot Type<select id="m-plot-type">${typeOptions}</select></label>
      <label>Marla<input type="number" id="m-plot-marla"></label>
      <label>Square Feet<input type="number" id="m-plot-sqft"></label>
      <label>Base Price<input type="number" id="m-plot-price"></label>
      <label>Category<input type="text" id="m-plot-category" placeholder="corner, main road..."></label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="m-plot-save">Create</button>
    </div>
  `);
  document.getElementById('m-plot-save').addEventListener('click', async () => {
    const plot_code = document.getElementById('m-plot-code').value.trim();
    if (!plot_code) return;
    try {
      await api('/plots', {
        method: 'POST',
        body: JSON.stringify({
          plot_code,
          project_id: selectedProjectId,
          plot_type_id: document.getElementById('m-plot-type').value,
          marla: document.getElementById('m-plot-marla').value || null,
          square_feet: document.getElementById('m-plot-sqft').value || null,
          base_price: document.getElementById('m-plot-price').value || null,
          category: document.getElementById('m-plot-category').value || null
        })
      });
      closeModal();
      loadPlots();
    } catch (e) {
      alert(e.message);
    }
  });
});

document.getElementById('bulk-plot-btn').addEventListener('click', () => {
  if (!selectedProjectId) return alert('Select or create a project first.');
  openModal(`
    <h3>Bulk Create Plots</h3>
    <div class="form-grid">
      <label>Prefix<input type="text" id="m-bulk-prefix" placeholder="e.g. A-"></label>
      <label>Start Number<input type="number" id="m-bulk-start" value="1"></label>
      <label>Count<input type="number" id="m-bulk-count" value="10"></label>
      <label>Marla (each)<input type="number" id="m-bulk-marla"></label>
      <label>Base Price (each)<input type="number" id="m-bulk-price"></label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="m-bulk-save">Create</button>
    </div>
  `);
  document.getElementById('m-bulk-save').addEventListener('click', async () => {
    const result = await api('/plots/bulk', {
      method: 'POST',
      body: JSON.stringify({
        project_id: selectedProjectId,
        prefix: document.getElementById('m-bulk-prefix').value,
        start_number: Number(document.getElementById('m-bulk-start').value),
        count: Number(document.getElementById('m-bulk-count').value),
        marla: document.getElementById('m-bulk-marla').value || null,
        base_price: document.getElementById('m-bulk-price').value || null
      })
    });
    closeModal();
    loadPlots();
    alert(`Created ${result.created_count} plots.`);
  });
});

async function lookupPlot(code) {
  try {
    const results = await api(`/plots?plot_code=${encodeURIComponent(code)}`);
    if (!results.length) return alert('Plot not found.');
    const plot = await api(`/plots/${results[0].plot_id}`);
    const owner = plot.current_owner
      ? `${plot.current_owner.full_name} (${plot.current_owner.phone || 'no phone'})`
      : 'No current owner (available)';

    let scheduleHtml = '<p class="hint">No active sale contract on this plot.</p>';
    let printBtn = '';
    if (plot.contract) {
      const full = await api(`/sales/${plot.contract.contract_id}`);
      scheduleHtml = `
        <table class="data-table">
          <thead><tr><th>#</th><th>Due</th><th>Amount</th><th>Paid</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${full.schedule.map((s, i) => `
              <tr>
                <td>${i + 1}</td><td>${s.due_date}</td>
                <td>${Number(s.due_amount).toLocaleString()}</td>
                <td>${Number(s.paid_amount).toLocaleString()}</td>
                <td>${s.status}</td>
                <td>${s.status !== 'paid' ? `<button class="btn-secondary pay-inline" data-id="${s.installment_id}" data-due="${s.due_amount - s.paid_amount}">Pay</button>` : ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      printBtn = `<a href="${API}/documents/agreement/${plot.contract.contract_id}" target="_blank">
                    <button type="button" class="btn-secondary" style="margin-top:10px;">Print Agreement</button>
                   </a>`;
    }

    openModal(`
      <h3>Plot <span class="code-stamp">${plot.plot_code}</span></h3>
      <p><strong>Project:</strong> ${plot.project_name || '-'}<br>
         <strong>Status:</strong> ${plot.status}<br>
         <strong>Marla:</strong> ${plot.marla || '-'}<br>
         <strong>Base Price:</strong> ${plot.base_price ? Number(plot.base_price).toLocaleString() : '-'}<br>
         <strong>Current Owner:</strong> ${owner}</p>
      <h3 style="font-size:14px; margin-top:20px;">Installments</h3>
      ${scheduleHtml}
      ${printBtn}
      <button type="button" class="btn-secondary" id="show-legacy-ledger-btn" style="margin-top:10px;">View Legacy Transaction History</button>
      <div id="legacy-ledger-container"></div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Close</button>
      </div>
    `);

    const legacyBtn = document.getElementById('show-legacy-ledger-btn');
    if (legacyBtn) {
      legacyBtn.addEventListener('click', async () => {
        const container = document.getElementById('legacy-ledger-container');
        legacyBtn.disabled = true;
        legacyBtn.textContent = 'Loading...';
        try {
          const entries = await api(`/plots/${plot.plot_id}/legacy-ledger`);
          if (!entries.length) {
            container.innerHTML = '<p class="hint" style="margin-top:10px;">No legacy transaction history for this plot.</p>';
          } else {
            container.innerHTML = `
              <div style="max-height:280px; overflow-y:auto; overflow-x:auto; margin-top:10px;">
                <table class="data-table">
                  <thead><tr><th>Date</th><th>Particular</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
                  <tbody>
                    ${entries.map(e => `
                      <tr>
                        <td>${e.entry_date || '-'}</td>
                        <td>${e.particular || '-'}</td>
                        <td>${e.debit ? Number(e.debit).toLocaleString() : ''}</td>
                        <td>${e.credit ? Number(e.credit).toLocaleString() : ''}</td>
                        <td>${e.running_balance !== null ? Number(e.running_balance).toLocaleString() : '-'}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>
              <p class="hint" style="margin-top:8px;">${entries.length} transactions imported from the legacy software.</p>
            `;
          }
          legacyBtn.style.display = 'none';
        } catch (e) {
          container.innerHTML = `<p class="hint" style="margin-top:10px;">${e.message}</p>`;
          legacyBtn.disabled = false;
          legacyBtn.textContent = 'View Legacy Transaction History';
        }
      });
    }

    document.querySelectorAll('.pay-inline').forEach(btn => {
      btn.addEventListener('click', async () => {
        const amount = prompt('Amount received:', btn.dataset.due);
        if (!amount) return;
        const date = new Date().toISOString().slice(0, 10);
        try {
          await api(`/installments/${btn.dataset.id}/pay`, {
            method: 'POST',
            body: JSON.stringify({ paid_amount: Number(amount), paid_date: date, payment_mode: 'cash' })
          });
          lookupPlot(code);
        } catch (e) {
          alert(e.message);
        }
      });
    });
  } catch (e) {
    alert(e.message);
  }
}

document.getElementById('plot-code-search-btn').addEventListener('click', () => {
  const code = document.getElementById('plot-code-search').value.trim();
  if (code) lookupPlot(code);
});

// ---------- CUSTOMERS ----------
async function loadCustomers(search) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  const customers = await api(`/customers${qs}`);
  const tbody = document.querySelector('#customers-table tbody');
  tbody.innerHTML = '';
  customers.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.full_name}</td><td>${c.father_name || '-'}</td>
      <td>${c.cnic || '-'}</td><td>${c.phone || '-'}</td>
      <td><button class="btn-secondary" data-id="${c.customer_id}">Ledger</button></td>
    `;
    tr.querySelector('button').addEventListener('click', () => showCustomerLedger(c.customer_id));
    tbody.appendChild(tr);
  });
}

document.getElementById('customer-search').addEventListener('input', (e) => {
  loadCustomers(e.target.value);
});

document.getElementById('new-customer-btn').addEventListener('click', () => {
  openModal(`
    <h3>New Customer</h3>
    <div class="form-grid">
      <label>Full Name<input type="text" id="m-cust-name"></label>
      <label>Father's Name<input type="text" id="m-cust-father"></label>
      <label>CNIC<input type="text" id="m-cust-cnic"></label>
      <label>Phone<input type="text" id="m-cust-phone"></label>
      <label>WhatsApp Number<input type="text" id="m-cust-whatsapp"></label>
      <label>Address<textarea id="m-cust-address" rows="2"></textarea></label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="m-cust-save">Create</button>
    </div>
  `);
  document.getElementById('m-cust-save').addEventListener('click', async () => {
    const full_name = document.getElementById('m-cust-name').value.trim();
    if (!full_name) return;
    await api('/customers', {
      method: 'POST',
      body: JSON.stringify({
        full_name,
        father_name: document.getElementById('m-cust-father').value,
        cnic: document.getElementById('m-cust-cnic').value,
        phone: document.getElementById('m-cust-phone').value,
        whatsapp_number: document.getElementById('m-cust-whatsapp').value,
        address: document.getElementById('m-cust-address').value
      })
    });
    closeModal();
    loadCustomers();
  });
});

async function showCustomerLedger(id) {
  const c = await api(`/customers/${id}`);
  const panel = document.getElementById('customer-detail-panel');
  const body = document.getElementById('customer-detail-body');
  panel.style.display = 'block';
  if (!c.ownership_history.length) {
    body.innerHTML = `<p>${c.full_name} has no plot ownership history yet.</p>`;
  } else {
    body.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Plot Code</th><th>Start Date</th><th>End Date</th><th>Status</th><th>Type</th></tr></thead>
        <tbody>
          ${c.ownership_history.map(o => `
            <tr>
              <td><span class="code-stamp">${o.plot_code}</span></td><td>${o.start_date}</td><td>${o.end_date || 'current'}</td>
              <td>${o.is_current ? 'Current owner' : 'Past owner'}</td><td>${o.acquisition_type}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }
  panel.scrollIntoView({ behavior: 'smooth' });
}

async function loadCustomerOptions() {
  const customers = await api('/customers');
  const opts = customers.map(c => `<option value="${c.customer_id}">${c.full_name} (${c.cnic || 'no CNIC'})</option>`).join('');
  ['sale-customer', 'transfer-customer', 'resale-customer', 'wa-customer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

// ---------- SALES ----------
document.getElementById('sale-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultDiv = document.getElementById('sale-result');
  try {
    const plotCode = document.getElementById('sale-plot-code').value.trim();
    const plots = await api(`/plots?plot_code=${encodeURIComponent(plotCode)}`);
    if (!plots.length) throw new Error(`Plot code ${plotCode} not found.`);

    const contract = await api('/sales', {
      method: 'POST',
      body: JSON.stringify({
        plot_id: plots[0].plot_id,
        customer_id: document.getElementById('sale-customer').value,
        total_price: Number(document.getElementById('sale-total-price').value),
        down_payment: Number(document.getElementById('sale-down-payment').value || 0),
        contract_date: document.getElementById('sale-contract-date').value,
        plan_type: document.getElementById('sale-plan-type').value,
        number_of_installments: Number(document.getElementById('sale-num-installments').value),
        english_clause_text: document.getElementById('sale-english-clause').value,
        urdu_clause_text: document.getElementById('sale-urdu-clause').value
      })
    });

    resultDiv.innerHTML = `<div class="result-card">Contract #${contract.contract_id} created.
      Installment amount: ${Number(contract.installment_amount).toLocaleString()} ×
      ${contract.number_of_installments}.</div>`;
    document.getElementById('sale-print-link').innerHTML =
      `<a href="${API}/documents/agreement/${contract.contract_id}" target="_blank">
         <button type="button" class="btn-secondary" style="margin-top:10px;">Print Sale Agreement</button>
       </a>`;
    e.target.reset();
    loadPlots();
    celebrateFromElement(e.target.querySelector('button[type=submit]'));

  } catch (err) {
    resultDiv.innerHTML = `<div class="result-card error">${err.message}</div>`;
  }
});

// ---------- RECOVERY ----------
async function loadOutstanding() {
  const rows = await api('/reports/outstanding');
  const tbody = document.querySelector('#outstanding-table tbody');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.full_name}</td><td>${r.phone || '-'}</td><td><span class="code-stamp">${r.plot_code}</span></td>
      <td>${Number(r.outstanding).toLocaleString()}</td>
      <td>${r.overdue_count > 0 ? `<span class="status-pill status-bought_back">${r.overdue_count} overdue</span>` : '0'}</td>
    `;
    tbody.appendChild(tr);
  });
}
document.getElementById('refresh-outstanding').addEventListener('click', loadOutstanding);

document.getElementById('pay-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultDiv = document.getElementById('pay-result');
  try {
    const inst = await api(`/installments/${document.getElementById('pay-installment-id').value}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        paid_amount: Number(document.getElementById('pay-amount').value),
        paid_date: document.getElementById('pay-date').value,
        payment_mode: document.getElementById('pay-mode').value
      })
    });
    resultDiv.innerHTML = `<div class="result-card">Installment #${inst.installment_id} now "${inst.status}". Paid: ${Number(inst.paid_amount).toLocaleString()} / ${Number(inst.due_amount).toLocaleString()}</div>`;
    e.target.reset();
    loadOutstanding();
  } catch (err) {
    resultDiv.innerHTML = `<div class="result-card error">${err.message}</div>`;
  }
});

// ---------- TRANSFER ----------
document.getElementById('transfer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultDiv = document.getElementById('transfer-result');
  try {
    const plotCode = document.getElementById('transfer-plot-code').value.trim();
    const plots = await api(`/plots?plot_code=${encodeURIComponent(plotCode)}`);
    if (!plots.length) throw new Error(`Plot code ${plotCode} not found.`);

    const result = await api(`/plots/${plots[0].plot_id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({
        new_customer_id: document.getElementById('transfer-customer').value,
        transfer_date: document.getElementById('transfer-date').value,
        transfer_fee: Number(document.getElementById('transfer-fee').value || 0)
      })
    });
    resultDiv.innerHTML = `<div class="result-card">Plot ${plotCode} transferred. Plot code unchanged; new ownership record #${result.new_ownership_id} is now current.</div>`;
    e.target.reset();
  } catch (err) {
    resultDiv.innerHTML = `<div class="result-card error">${err.message}</div>`;
  }
});

// ---------- PWA: register service worker for installability ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // Non-fatal - app still works as a normal website if this fails
    });
  });
}

// Capture the browser's install prompt so we can trigger it from our own button
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('install-app-btn');
  if (btn) btn.style.display = 'block';
});

document.getElementById('install-app-btn')?.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('install-app-btn').style.display = 'none';
});

window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('install-app-btn');
  if (btn) btn.style.display = 'none';
});

// ---------- Init ----------
applyTranslations();

document.getElementById('lang-toggle-btn')?.addEventListener('click', toggleLanguage);
document.getElementById('lang-toggle-auth')?.addEventListener('click', toggleLanguage);

checkAuth().catch(() => {
  // Server unreachable on first load - still show the sign-in form with a clear message
  isSetupMode = false;
  showAuthScreen();
  const errDiv = document.getElementById('auth-error');
  errDiv.textContent = 'Cannot reach the server. Check your connection and refresh.';
  errDiv.style.display = 'block';
});


// ============================================================
// Celebration particle burst (used on key successful actions)
// ============================================================
function celebrate(x, y) {
  const colors = ['#A97F3F', '#C39A5C', '#5B7A63', '#9C4A34'];
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    const angle = (Math.PI * 2 * i) / 24;
    const dist = 60 + Math.random() * 60;
    const color = colors[i % colors.length];
    p.style.cssText = `
      position:fixed; left:${x}px; top:${y}px; width:8px; height:8px;
      background:${color}; border-radius:50%; pointer-events:none; z-index:999;
      box-shadow:0 0 8px ${color};
      transition: transform 0.7s cubic-bezier(0.16,1,0.3,1), opacity 0.7s ease;
      transform: translate(0,0) scale(1); opacity: 1;
    `;
    document.body.appendChild(p);
    requestAnimationFrame(() => {
      p.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0)`;
      p.style.opacity = '0';
    });
    setTimeout(() => p.remove(), 750);
  }
}
function celebrateFromElement(el) {
  const rect = el.getBoundingClientRect();
  celebrate(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

// ============================================================
// ACCOUNTING
// ============================================================
async function loadAccounting() {
  try {
    const tb = await api('/reports/trial-balance');
    const summary = document.getElementById('trial-balance-summary');
    summary.innerHTML = `
      <div class="stat-card tilt-card"><div class="stat-icon">💰</div><div class="stat-value">${Math.round(tb.totals.debit).toLocaleString()}</div><div class="stat-label">Total Debit</div></div>
      <div class="stat-card tilt-card"><div class="stat-icon">📗</div><div class="stat-value">${Math.round(tb.totals.credit).toLocaleString()}</div><div class="stat-label">Total Credit</div></div>
      <div class="stat-card tilt-card"><div class="stat-icon">${tb.totals.debit === tb.totals.credit ? '✅' : '⚠️'}</div><div class="stat-value" style="font-size:20px;">${tb.totals.debit === tb.totals.credit ? 'Balanced' : 'Check entries'}</div><div class="stat-label">Ledger Status</div></div>
    `;
    const tbody = document.querySelector('#trial-balance-table tbody');
    tbody.innerHTML = tb.accounts.map(a => `
      <tr>
        <td>${a.account_code}</td><td>${a.account_name}</td><td>${a.account_type || '-'}</td>
        <td>${a.total_debit ? Number(a.total_debit).toLocaleString() : '-'}</td>
        <td>${a.total_credit ? Number(a.total_credit).toLocaleString() : '-'}</td>
      </tr>`).join('');

    const vouchers = await api('/vouchers');
    const vtbody = document.querySelector('#vouchers-table tbody');
    vtbody.innerHTML = vouchers.map(v => `
      <tr><td>${v.voucher_no}</td><td>${v.voucher_type}</td><td>${v.voucher_date}</td><td>${v.narration || '-'}</td></tr>
    `).join('') || '<tr><td colspan="4">No vouchers yet.</td></tr>';
    attachTiltEffect();
  } catch (e) { console.error(e); }
}

// ============================================================
// BROKERS
// ============================================================
async function loadBrokers() {
  const brokers = await api('/brokers');
  document.querySelector('#brokers-table tbody').innerHTML = brokers.map(b => `
    <tr><td>${b.full_name}</td><td>${b.phone || '-'}</td><td>${b.commission_rate}%</td></tr>
  `).join('') || '<tr><td colspan="3">No brokers yet.</td></tr>';
}

document.getElementById('new-broker-btn').addEventListener('click', () => {
  openModal(`
    <h3>New Broker</h3>
    <div class="form-grid">
      <label>Full Name<input type="text" id="m-broker-name"></label>
      <label>Phone<input type="text" id="m-broker-phone"></label>
      <label>Commission Rate (%)<input type="number" id="m-broker-rate" value="1" step="0.1"></label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="m-broker-save">Create</button>
    </div>
  `);
  document.getElementById('m-broker-save').addEventListener('click', async () => {
    const full_name = document.getElementById('m-broker-name').value.trim();
    if (!full_name) return;
    await api('/brokers', {
      method: 'POST',
      body: JSON.stringify({
        full_name,
        phone: document.getElementById('m-broker-phone').value,
        commission_rate: Number(document.getElementById('m-broker-rate').value)
      })
    });
    closeModal();
    loadBrokers();
  });
});

// ============================================================
// LANDLORDS
// ============================================================
async function loadLandlords() {
  const landlords = await api('/landlords');
  document.querySelector('#landlords-table tbody').innerHTML = landlords.map(l => `
    <tr>
      <td>${l.full_name}</td><td>${l.land_area || '-'}</td>
      <td>${l.purchase_price ? Number(l.purchase_price).toLocaleString() : '-'}</td>
      <td><button class="btn-secondary" data-id="${l.landlord_id}">Documents</button></td>
    </tr>`).join('') || '<tr><td colspan="4">No landlords yet.</td></tr>';
  document.querySelectorAll('#landlords-table button').forEach(btn => {
    btn.addEventListener('click', () => showLandlordDocs(btn.dataset.id));
  });
}

document.getElementById('new-landlord-btn').addEventListener('click', () => {
  openModal(`
    <h3>New Landlord</h3>
    <div class="form-grid">
      <label>Full Name<input type="text" id="m-ll-name"></label>
      <label>CNIC<input type="text" id="m-ll-cnic"></label>
      <label>Phone<input type="text" id="m-ll-phone"></label>
      <label>Land Area (Kanal/Marla)<input type="number" id="m-ll-area"></label>
      <label>Purchase Price<input type="number" id="m-ll-price"></label>
      <label>Purchase Date<input type="date" id="m-ll-date"></label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="m-ll-save">Create</button>
    </div>
  `);
  document.getElementById('m-ll-save').addEventListener('click', async () => {
    const full_name = document.getElementById('m-ll-name').value.trim();
    if (!full_name) return;
    await api('/landlords', {
      method: 'POST',
      body: JSON.stringify({
        full_name,
        cnic: document.getElementById('m-ll-cnic').value,
        phone: document.getElementById('m-ll-phone').value,
        land_area: document.getElementById('m-ll-area').value || null,
        purchase_price: document.getElementById('m-ll-price').value || null,
        purchase_date: document.getElementById('m-ll-date').value || null
      })
    });
    closeModal();
    loadLandlords();
  });
});

async function showLandlordDocs(id) {
  const ll = await api(`/landlords/${id}`);
  const panel = document.getElementById('landlord-detail-panel');
  const body = document.getElementById('landlord-detail-body');
  panel.style.display = 'block';
  body.innerHTML = `
    <p><strong>${ll.full_name}</strong></p>
    <div id="ll-docs-list">
      ${ll.documents.map(d => `<p>📄 <a href="${d.file_path}" target="_blank">${d.doc_title}</a></p>`).join('') || '<p class="hint">No documents uploaded yet.</p>'}
    </div>
    <form id="ll-upload-form" style="margin-top:14px; display:flex; gap:10px; align-items:end; flex-wrap:wrap;">
      <label style="display:flex; flex-direction:column; gap:6px; font-size:12.5px; color:var(--ink-dim);">
        Document Title
        <input type="text" id="ll-doc-title" placeholder="e.g. Sale Deed">
      </label>
      <label style="display:flex; flex-direction:column; gap:6px; font-size:12.5px; color:var(--ink-dim);">
        File
        <input type="file" id="ll-doc-file" required>
      </label>
      <button type="submit" class="btn-primary">Upload</button>
    </form>
  `;
  document.getElementById('ll-upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('ll-doc-file');
    if (!fileInput.files.length) return;
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('doc_title', document.getElementById('ll-doc-title').value || fileInput.files[0].name);
    await fetch(`${API}/landlords/${id}/documents`, { method: 'POST', body: formData });
    showLandlordDocs(id);
  });
  panel.scrollIntoView({ behavior: 'smooth' });
}

// ============================================================
// TEAM / USERS
// ============================================================
async function loadUsers() {
  const users = await api('/users');
  document.querySelector('#users-table tbody').innerHTML = users.map(u => `
    <tr>
      <td>${u.full_name}</td><td>${u.username}</td><td>${u.role}</td>
      <td><span class="status-pill ${u.is_active ? 'status-available' : 'status-bought_back'}">${u.is_active ? 'active' : 'disabled'}</span></td>
    </tr>`).join('');
}

document.getElementById('new-user-btn').addEventListener('click', () => {
  openModal(`
    <h3>New Team Member</h3>
    <div class="form-grid">
      <label>Full Name<input type="text" id="m-user-name"></label>
      <label>Username<input type="text" id="m-user-username"></label>
      <label>Password<input type="password" id="m-user-password"></label>
      <label>Role
        <select id="m-user-role">
          <option value="staff">Staff</option>
          <option value="agent">Sales Agent</option>
          <option value="accountant">Accountant</option>
          <option value="admin">Admin</option>
        </select>
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="m-user-save">Create</button>
    </div>
  `);
  document.getElementById('m-user-save').addEventListener('click', async () => {
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: document.getElementById('m-user-name').value.trim(),
          username: document.getElementById('m-user-username').value.trim(),
          password: document.getElementById('m-user-password').value,
          role: document.getElementById('m-user-role').value
        })
      });
      closeModal();
      loadUsers();
    } catch (e) {
      alert(e.message);
    }
  });
});

// ============================================================
// NOC & RESALE
// ============================================================
document.getElementById('noc-check-btn').addEventListener('click', async () => {
  const code = document.getElementById('noc-plot-code').value.trim();
  const resultDiv = document.getElementById('noc-status-result');
  if (!code) return;
  try {
    const plots = await api(`/plots?plot_code=${encodeURIComponent(code)}`);
    if (!plots.length) throw new Error('Plot not found');
    const status = await api(`/plots/${plots[0].plot_id}/noc-status`);
    if (status.already_issued) {
      resultDiv.innerHTML = `<div class="result-card">NOC already issued on ${status.noc.issue_date}.
        <a href="${API}/documents/noc/${status.noc.noc_id}" target="_blank">Print it</a></div>`;
    } else if (status.eligible) {
      resultDiv.innerHTML = `<div class="result-card">Eligible — all installments cleared.
        <button class="btn-primary" id="issue-noc-btn" style="margin-top:10px;">Issue NOC</button></div>`;
      document.getElementById('issue-noc-btn').addEventListener('click', async (ev) => {
        const noc = await api(`/plots/${plots[0].plot_id}/noc`, { method: 'POST', body: JSON.stringify({}) });
        celebrateFromElement(ev.target);
        resultDiv.innerHTML = `<div class="result-card">NOC issued! <a href="${API}/documents/noc/${noc.noc_id}" target="_blank">Print it</a></div>`;
      });
    } else {
      resultDiv.innerHTML = `<div class="result-card error">Not eligible. Outstanding balance: Rs. ${Number(status.outstanding_balance).toLocaleString()}</div>`;
    }
  } catch (e) {
    resultDiv.innerHTML = `<div class="result-card error">${e.message}</div>`;
  }
});

document.getElementById('buyback-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultDiv = document.getElementById('buyback-result');
  try {
    const code = document.getElementById('buyback-plot-code').value.trim();
    const plots = await api(`/plots?plot_code=${encodeURIComponent(code)}`);
    if (!plots.length) throw new Error('Plot not found');
    await api(`/plots/${plots[0].plot_id}/buyback`, {
      method: 'POST',
      body: JSON.stringify({
        amount: Number(document.getElementById('buyback-amount').value),
        txn_date: document.getElementById('buyback-date').value
      })
    });
    resultDiv.innerHTML = `<div class="result-card">Plot ${code} bought back. It's now available for resale.</div>`;
    e.target.reset();
  } catch (err) {
    resultDiv.innerHTML = `<div class="result-card error">${err.message}</div>`;
  }
});

document.getElementById('resale-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultDiv = document.getElementById('resale-result');
  try {
    const code = document.getElementById('resale-plot-code').value.trim();
    const plots = await api(`/plots?plot_code=${encodeURIComponent(code)}`);
    if (!plots.length) throw new Error('Plot not found');
    const result = await api(`/plots/${plots[0].plot_id}/resale`, {
      method: 'POST',
      body: JSON.stringify({
        new_customer_id: document.getElementById('resale-customer').value,
        amount: Number(document.getElementById('resale-amount').value),
        txn_date: document.getElementById('resale-date').value
      })
    });
    const plColor = result.profit_loss_amount >= 0 ? 'profit' : 'loss';
    resultDiv.innerHTML = `<div class="result-card">Resale recorded. ${plColor === 'profit' ? 'Profit' : 'Loss'} of Rs. ${Math.abs(result.profit_loss_amount).toLocaleString()} posted to voucher ${result.posted_to_voucher}.</div>`;
    celebrateFromElement(e.target.querySelector('button[type=submit]'));
    e.target.reset();
  } catch (err) {
    resultDiv.innerHTML = `<div class="result-card error">${err.message}</div>`;
  }
});

// ============================================================
// WhatsApp, Biometric, Registry Fee
// ============================================================
document.getElementById('whatsapp-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultDiv = document.getElementById('whatsapp-result');
  try {
    const result = await api('/notifications/whatsapp', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: document.getElementById('wa-customer').value,
        message_text: document.getElementById('wa-message').value
      })
    });
    resultDiv.innerHTML = `<div class="result-card">✓ Message sent to customer.</div>`;
  } catch (err) {
    resultDiv.innerHTML = `<div class="result-card error">${err.message}</div>`;
  }
});

document.getElementById('biometric-btn').addEventListener('click', async (e) => {
  const resultDiv = document.getElementById('biometric-result');
  setFingerprintState('scanning');
  e.target.textContent = 'Scanning...';
  e.target.disabled = true;
  resultDiv.innerHTML = '';

  setTimeout(async () => {
    try {
      const result = await api('/biometric/capture', { method: 'POST', body: JSON.stringify({}) });
      setFingerprintState('success');
      resultDiv.innerHTML = `<div class="result-card">✓ Fingerprint captured — reference <code>${result.biometric_ref}</code></div>`;
      e.target.textContent = 'Scan Fingerprint';
      e.target.disabled = false;
      celebrateFromElement(e.target);
      setTimeout(() => setFingerprintState('idle'), 2200);
    } catch (err) {
      setFingerprintState('idle');
      e.target.textContent = 'Scan Fingerprint';
      e.target.disabled = false;
      resultDiv.innerHTML = `<div class="result-card error">${err.message}</div>`;
    }
  }, 1800);
});

document.getElementById('registry-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultDiv = document.getElementById('registry-result');
  try {
    const result = await api('/registry-fee/calculate', {
      method: 'POST',
      body: JSON.stringify({
        plot_size_marla: Number(document.getElementById('registry-marla').value),
        sale_value: Number(document.getElementById('registry-value').value)
      })
    });
    resultDiv.innerHTML = `<div class="result-card">
      Stamp Duty: Rs. ${result.stamp_duty.toLocaleString()}<br>
      Registration Fee: Rs. ${result.registration_fee.toLocaleString()}<br>
      <strong>Total: Rs. ${result.total.toLocaleString()}</strong></div>
`;
  } catch (err) {
    resultDiv.innerHTML = `<div class="result-card error">${err.message}</div>`;
  }
});

// ============================================================
// MIGRATION REPORT
// ============================================================
async function loadMigrationReport() {
  try {
    const summary = await api('/migration/summary');
    const t = summary.totals;
    document.getElementById('migration-stats').innerHTML = `
      <div class="stat-card tilt-card"><div class="stat-icon">👥</div><div class="stat-value">${t.customers}</div><div class="stat-label">Real Customers Imported</div></div>
      <div class="stat-card tilt-card"><div class="stat-icon">📐</div><div class="stat-value">${t.plots}</div><div class="stat-label">Real Plots Imported</div></div>
      <div class="stat-card tilt-card"><div class="stat-icon">📜</div><div class="stat-value">${t.legacy_ledger_entries.toLocaleString()}</div><div class="stat-label">Historical Transactions</div></div>
      <div class="stat-card tilt-card"><div class="stat-icon">🏞️</div><div class="stat-value">${t.landlords}</div><div class="stat-label">Landowner Records</div></div>
    `;
    document.getElementById('migration-details').innerHTML = `
      <p><strong>${t.migration_vouchers_pending_review}</strong> internal legacy accounts (Office Cash, Salary, Bank, Tax, staff expenses)
      were <strong>not</strong> imported as fake customers. They were posted into Accounting as vouchers against a
      <strong>"Migration Suspense"</strong> account (code 2900), fully traceable back to the original legacy account name and code.</p>
      <p>Migration Suspense net balance right now: <strong>Rs. ${t.migration_suspense_balance ? Math.round(t.migration_suspense_balance).toLocaleString() : '0'}</strong>
      — this should be reviewed by an accountant and reclassified into proper permanent accounts over time. Nothing in this bucket
      has been permanently categorized; it's a clearing account by design.</p>
      <p>Every legacy plot account's full historical transaction ledger (${t.legacy_ledger_entries.toLocaleString()} entries) was preserved
      and is viewable per-plot from Projects &amp; Plots → look up a plot code → "Legacy Transaction History".</p>
    `;
    attachTiltEffect();
  } catch (e) {
    document.getElementById('migration-details').innerHTML = '<p class="hint">No migration has been run on this database yet.</p>';
  }
}
