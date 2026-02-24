const API_BASE = 'http://localhost:3000/api/v1';
let jwt = null;
let currentUser = {};
let clientPage = 1;
let waStatusInterval = null;

function headers() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt }; }

async function doLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    try {
        const res = await fetch(`${API_BASE}/auth/login/auth`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: u, clave: p }) // Coincidir con especificación admin2026
        });
        const json = await res.json();
        if (res.ok) {
            jwt = json.token;
            currentUser = json.user;
            localStorage.setItem('token', jwt); // guardar token
            updateTopBar(json.user);
            if (currentUser.role !== 'ADMIN') {
                document.getElementById('nav-users').classList.add('hidden');
                document.getElementById('nav-whatsapp').classList.add('hidden');
            }
            document.getElementById('loginView').classList.add('hidden');
            document.getElementById('dashView').classList.remove('hidden');
            loadStats();
        } else {
            document.getElementById('login-error').textContent = json.error;
        }
    } catch (e) { document.getElementById('login-error').textContent = 'Error de conexión'; }
}

function updateTopBar(user) {
    document.getElementById('top-username').textContent = user.username;
    document.getElementById('top-role').textContent = user.role;
    if (user.photo) {
        document.getElementById('top-photo').src = user.photo;
    }
}

function logout() {
    jwt = null;
    localStorage.removeItem('token'); // limpiar token
    clearInterval(waStatusInterval);
    document.getElementById('dashView').classList.add('hidden');
    document.getElementById('loginView').classList.remove('hidden');
}

function showSection(name) {
    ['stats', 'clients', 'whatsapp', 'users', 'profile'].forEach(s => {
        const el = document.getElementById('sec-' + s);
        if (el) el.classList.add('hidden');
        const nav = document.getElementById('nav-' + s);
        if (nav) nav.classList.remove('active');
    });

    document.getElementById('sec-' + name).classList.remove('hidden');
    const nav = document.getElementById('nav-' + name);
    if (nav) nav.classList.add('active');

    if (name === 'stats') loadStats();
    if (name === 'clients') { clientPage = 1; loadClients(); }
    if (name === 'users' && currentUser.role === 'ADMIN') loadUsers();
    if (name === 'profile') loadMyProfile();
    if (name === 'whatsapp' && currentUser.role === 'ADMIN') startWhatsAppStatusPolling();
    else clearInterval(waStatusInterval);
}

async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/stats/dashboard`, { headers: headers() });
        const json = await res.json();
        const c = json.data.clientes, t = json.data.tokens;
        document.getElementById('s-total').textContent = c.total.toLocaleString();
        document.getElementById('s-ok').textContent = c.completos.toLocaleString();
        document.getElementById('s-proc').textContent = c.en_proceso.toLocaleString();
        document.getElementById('s-24h').textContent = json.data.actividad.registros_24h.toLocaleString();
        document.getElementById('s-tv').textContent = t.validados.toLocaleString();
        document.getElementById('s-tx').textContent = t.cancelados.toLocaleString();
        document.getElementById('s-te').textContent = t.expirados.toLocaleString();
        document.getElementById('s-tp').textContent = t.pendientes.toLocaleString();
    } catch (e) { }
}

async function loadClients(search) {
    const q = search || document.getElementById('client-search').value || '';
    try {
        const res = await fetch(`${API_BASE}/stats/clients?page=${clientPage}&limit=15&search=${q}`, { headers: headers() });
        const json = await res.json();
        const body = document.getElementById('clients-body');
        body.innerHTML = json.data.map(c => `
                    <tr>
                        <td><strong>${c.tipo_doc}</strong> ${c.documento}</td>
                        <td>${c.nombres} ${c.ap_paterno}</td>
                        <td>${c.celular || '-'}</td>
                        <td><span class="badge-status ${c.estado ? 'badge-ok' : 'badge-pending'}">${c.estado ? 'COMPLETO' : 'EN PROCESO'}</span></td>
                        <td>${new Date(c.created_at).toLocaleDateString()}</td>
                        <td><button class="btn-sm-action" onclick="viewDetail('${c.id}')">Ver</button></td>
                    </tr>
                `).join('');
        document.getElementById('page-info').textContent = `Página ${json.pagination.page} de ${json.pagination.pages} (${json.pagination.total} total)`;
    } catch (e) { }
}

function searchClients() { clientPage = 1; loadClients(); }
function changePage(d) { clientPage = Math.max(1, clientPage + d); loadClients(); }

// Verificar sesion
async function checkSession() {
    const stored = localStorage.getItem('token');
    if (!stored) return;
    jwt = stored;
    try {
        const res = await fetch(`${API_BASE}/auth/users`, { headers: headers() }); // Perfil simplificado a lista por ahora
        if (res.ok) {
            const json = await res.json();
            currentUser = json.data; // datos del perfil
            updateTopBar(currentUser);

            if (currentUser.role !== 'ADMIN') {
                document.getElementById('nav-users').classList.add('hidden');
                document.getElementById('nav-whatsapp').classList.add('hidden');
            }

            document.getElementById('loginView').classList.add('hidden');
            document.getElementById('dashView').classList.remove('hidden');
            loadStats();
        } else {
            logout();
        }
    } catch (e) { logout(); }
}

// Init
checkSession();

async function viewDetail(id) {
    try {
        const res = await fetch(`${API_BASE}/stats/clients/${id}`, { headers: headers() });
        const json = await res.json();
        const c = json.data;
        let html = `
                    <table>
                        <tr><td style="color:var(--muted)">Documento</td><td><strong>${c.tipo_doc} ${c.documento}</strong> (DV: ${c.dv})</td></tr>
                        <tr><td style="color:var(--muted)">Nombres</td><td>${c.nombres} ${c.ap_paterno} ${c.ap_materno}</td></tr>
                        <tr><td style="color:var(--muted)">Celular</td><td>${c.celular || '-'} (${c.operador || '-'})</td></tr>
                        <tr><td style="color:var(--muted)">Email</td><td>${c.email || '-'}</td></tr>
                        <tr><td style="color:var(--muted)">Ubicación</td><td>${c.departamento || '-'}, ${c.provincia || '-'}, ${c.distrito || '-'}</td></tr>
                        <tr><td style="color:var(--muted)">Términos</td><td>${c.acepto_terminos ? '✅ Aceptados' : '❌ No'}</td></tr>
                        <tr><td style="color:var(--muted)">Estado</td><td><span class="badge-status ${c.estado ? 'badge-ok' : 'badge-pending'}">${c.estado ? 'COMPLETO' : 'EN PROCESO'}</span></td></tr>
                        <tr><td style="color:var(--muted)">Registrado</td><td>${new Date(c.created_at).toLocaleString()}</td></tr>
                    </table>`;

        if (c.tokens && c.tokens.length > 0) {
            html += `<h6 style="margin-top:16px;font-size:.82rem;">Tokens (${c.tokens.length})</h6><table>
                        <thead><tr><th>VÍA</th><th>STATUS</th><th>IP</th><th>FECHA</th><th></th></tr></thead><tbody>`;
            for (const t of c.tokens) {
                const statusMap = { V: 'badge-ok', P: 'badge-pending', E: 'badge-expired', X: 'badge-fail' };
                const statusLabel = { V: 'VALIDADO', P: 'PENDIENTE', E: 'EXPIRADO', X: 'CANCELADO' };
                html += `<tr>
                            <td>${t.via === 'S' ? '📱 SMS' : '💬 WA'}</td>
                            <td><span class="badge-status ${statusMap[t.status]}">${statusLabel[t.status]}</span></td>
                            <td style="font-size:.75rem;">${t.ip_solicitante || '-'}</td>
                            <td style="font-size:.75rem;">${new Date(t.created_at).toLocaleString()}</td>
                            <td>${(currentUser.can_view_tokens || currentUser.role === 'ADMIN') ? `<button class="btn-sm-action" onclick="viewTokenCode('${t.id}')">🔓 Ver</button>` : ''}</td>
                        </tr>`;
            }
            html += '</tbody></table>';
        }
        document.getElementById('detail-content').innerHTML = html;
        document.getElementById('detail-modal').classList.remove('hidden');
    } catch (e) { }
}

// WhatsApp
async function startWhatsApp() {
    try {
        await fetch(`${API_BASE}/auth/whatsapp/start`, { method: 'POST', headers: headers() });
        startWhatsAppStatusPolling();
    } catch (e) { alert('Error al iniciar WhatsApp'); }
}

async function logoutWhatsApp() {
    if (!confirm('¿Seguro que desea cerrar sesión de WhatsApp?')) return;
    try {
        await fetch(`${API_BASE}/auth/whatsapp/logout`, { method: 'POST', headers: headers() });
    } catch (e) { }
}

function startWhatsAppStatusPolling() {
    if (waStatusInterval) clearInterval(waStatusInterval);
    pollWA();
    waStatusInterval = setInterval(pollWA, 3000);
}

async function pollWA() {
    try {
        const res = await fetch(`${API_BASE}/auth/whatsapp/status`, { headers: headers() });
        const json = await res.json();
        const badge = document.getElementById('wa-status-badge');
        const btnStart = document.getElementById('btn-wa-start');
        const btnStop = document.getElementById('btn-wa-stop');
        const qrCont = document.getElementById('wa-qr-container');
        const connMsg = document.getElementById('wa-connected-msg');

        badge.textContent = json.status.toUpperCase();
        badge.className = 'badge-status ' + (json.status === 'connected' ? 'badge-ok' : (json.status === 'connecting' ? 'badge-pending' : 'badge-fail'));

        if (json.status === 'connected') {
            btnStart.classList.add('hidden');
            btnStop.classList.remove('hidden');
            qrCont.classList.add('hidden');
            connMsg.classList.remove('hidden');
        } else {
            btnStart.classList.remove('hidden');
            btnStop.classList.add('hidden');
            connMsg.classList.add('hidden');

            if (json.qr) {
                qrCont.classList.remove('hidden');
                document.getElementById('wa-qr-img').src = json.qr;
                document.getElementById('wa-qr-img').classList.remove('hidden');
                document.getElementById('wa-qr-loading').classList.add('hidden');
            } else if (json.status === 'connecting') {
                qrCont.classList.remove('hidden');
                document.getElementById('wa-qr-img').classList.add('hidden');
                document.getElementById('wa-qr-loading').classList.remove('hidden');
            } else {
                qrCont.classList.add('hidden');
            }
        }
    } catch (e) { }
}

// Usuarios
async function loadUsers() {
    try {
        const res = await fetch(`${API_BASE}/auth/users`, { headers: headers() });
        const json = await res.json();
        const body = document.getElementById('users-body');
        body.innerHTML = json.data.map(u => `
                    <tr>
                        <td><img class="user-profile-img" src="${u.photo || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}"></td>
                        <td><strong>${u.username}</strong></td>
                        <td style="font-size:.78rem;">${u.email}</td>
                        <td><span class="badge-status badge-ok">${u.rol?.nombre || 'N/A'}</span></td>
                        <td><label class="toggle-switch"><input type="checkbox" ${u.can_view_stats ? 'checked' : ''} onchange="togglePerm('${u.id}','can_view_stats',this.checked)"><span class="slider"></span></label></td>
                        <td><label class="toggle-switch"><input type="checkbox" ${u.can_view_tokens ? 'checked' : ''} onchange="togglePerm('${u.id}','can_view_tokens',this.checked)"><span class="slider"></span></label></td>
                        <td><label class="toggle-switch"><input type="checkbox" ${u.status ? 'checked' : ''} onchange="togglePerm('${u.id}','status',this.checked)"><span class="slider"></span></label></td>
                    </tr>
                `).join('');
    } catch (e) { }
}

async function togglePerm(userId, field, value) {
    try {
        await fetch(`${API_BASE}/auth/users/${userId}/permissions`, {
            method: 'PUT', headers: headers(),
            body: JSON.stringify({ [field]: value })
        });
    } catch (e) { }
}

// Perfil
async function loadMyProfile() {
    try {
        const res = await fetch(`${API_BASE}/auth/profile`, { headers: headers() });
        const json = await res.json();
        const u = json.data;
        document.getElementById('profile-username').textContent = u.username;
        document.getElementById('profile-role').textContent = u.role;
        document.getElementById('profile-photo').src = u.photo || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        document.getElementById('edit-email').value = u.email || '';
        document.getElementById('edit-photo').value = u.photo || '';
        document.getElementById('edit-current-pass').value = '';
        document.getElementById('edit-new-pass').value = '';
    } catch (e) { }
}

async function updateMyProfile() {
    const body = {
        email: document.getElementById('edit-email').value,
        photo: document.getElementById('edit-photo').value,
        current_password: document.getElementById('edit-current-pass').value,
        new_password: document.getElementById('edit-new-pass').value
    };
    const msg = document.getElementById('profile-msg');
    msg.textContent = 'Guardando...';
    try {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            method: 'PUT', headers: headers(),
            body: JSON.stringify(body)
        });
        const json = await res.json();
        if (res.ok) {
            msg.style.color = 'var(--success)';
            msg.textContent = 'Perfil actualizado correctamente';
            loadMyProfile();
            updateTopBar(json.data);
        } else {
            msg.style.color = 'var(--danger)';
            msg.textContent = json.error;
        }
    } catch (e) { msg.textContent = 'Error'; }
}

function showCreateUser() { document.getElementById('create-user-form').classList.toggle('hidden'); }
async function createUser() {
    const body = {
        username: document.getElementById('new-username').value,
        password: document.getElementById('new-password').value,
        email: document.getElementById('new-email').value,
        rol_id: parseInt(document.getElementById('new-role').value)
    };
    try {
        const res = await fetch(`${API_BASE}/auth/user`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
        if (res.ok) {
            loadUsers();
            document.getElementById('create-user-form').classList.add('hidden');
        } else {
            const json = await res.json();
            alert(json.error);
        }
    } catch (e) { alert('Error'); }
}