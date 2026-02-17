const API = "http://localhost:3000/v1/api/client";
let clientId = null;
let timerInterval = null;
let tokenLength = 4;
let maxAttempts = 3;
let currentAttempts = 0;
let cooldownState = { S: { blocked: false, remaining: 0 }, W: { blocked: false, remaining: 0 } };
let cooldownIntervals = {};

// ──── utilidades ────
function onlyNumbers(el) { el.value = el.value.replace(/[^0-9]/g, ''); }
function onlyLetters(el) { el.value = el.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ''); }

function onTipoDocChange() {
    const tipo = document.getElementById('tipo_doc').value;
    const doc = document.getElementById('documento');
    if (tipo === 'DNI') doc.maxLength = 8;
    else if (tipo === 'RUC') doc.maxLength = 11;
    else doc.maxLength = 9;
    doc.value = doc.value.substring(0, doc.maxLength);
}

function goStep(n) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(n === 'success' ? 'step-success' : 'step' + n).classList.add('active');
}

function onAcceptChange() {
    document.getElementById('btn-registrar').disabled = !document.getElementById('accept').checked;
}

function getVia() { return document.querySelector('input[name="via"]:checked').value; }

//  PASO 1: registro 
async function submitStep1() {
    const tipo = document.getElementById('tipo_doc').value;
    const doc = document.getElementById('documento').value;
    const dv = document.getElementById('dv').value;
    const nombres = document.getElementById('nombres').value.trim();
    const ap_p = document.getElementById('ap_paterno').value.trim();
    const ap_m = document.getElementById('ap_materno').value.trim();

    // validaciones  delk frontend
    const lens = { DNI: 8, RUC: 11, CDE: 9 };
    if (doc.length !== lens[tipo]) return alert(`${tipo} debe tener ${lens[tipo]} dígitos`);
    if (dv.length !== 1) return alert('Dígito verificador requerido (1 dígito)');
    if (!nombres || nombres.length < 2) return alert('Ingrese nombres válidos');
    if (!ap_p || ap_p.length < 2) return alert('Ingrese apellido paterno');
    if (!ap_m || ap_m.length < 2) return alert('Ingrese apellido materno');

    try {
        const res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo_documento: tipo, documento: doc, dv, nombres, ap_paterno: ap_p, ap_materno: ap_m })
        });
        const json = await res.json();

        if (res.ok) {
            clientId = json.data.id;
            goStep(2);
            fetchCooldown();
        } else if (json.code === 'ALREADY_REGISTERED') {
            document.getElementById('alreadyModal').classList.add('active');
        } else {
            alert(json.error);
        }
    } catch (e) { alert('Error de conexión con el servidor'); }
}

//  PASO 2: solicitar token 
async function submitStep2() {
    const cel = document.getElementById('celular').value;
    const op = document.getElementById('operador').value;
    const via = getVia();

    if (cel.length !== 9) return alert('Celular debe tener 9 dígitos');

    try {
        const res = await fetch(`${API}/${clientId}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ celular: cel, operador: op, via })
        });
        const json = await res.json();

        if (res.status === 429) {
            startCooldown(json.via_bloqueada || via, json.remaining_seconds, json.intentos);
            return;
        }
        if (res.ok) {
            tokenLength = json.data.token_length || 4;
            currentAttempts = 0;
            openModal(json.data.expires_in_seconds);
        } else {
            alert(json.error);
        }
    } catch (e) { alert('Error de conexión'); }
}

//  MODAL: abrir 
function openModal(expireSecs) {
    const container = document.getElementById('token-inputs');
    container.innerHTML = '';
    for (let i = 0; i < tokenLength; i++) {
        const input = document.createElement('input');
        input.className = 'token-box';
        input.type = 'text';
        input.maxLength = 1;
        input.dataset.index = i;
        input.addEventListener('input', onTokenInput);
        input.addEventListener('keydown', onTokenKeydown);
        container.appendChild(input);
    }

    document.getElementById('modal-error').classList.remove('visible');
    document.getElementById('expire-msg').classList.remove('visible');
    document.getElementById('btn-resend').disabled = true;
    updateAttemptsBadge();
    updateSecurityBar();

    document.getElementById('tokenModal').classList.add('active');
    container.children[0].focus();
    startTimer(expireSecs);
}

function onTokenInput(e) {
    const val = e.target.value;
    // permitir solo alfanuméricos, sin ñ
    e.target.value = val.replace(/[^a-zA-Z0-9]/g, '').substring(0, 1);
    if (e.target.value && e.target.dataset.index < tokenLength - 1) {
        const next = e.target.parentElement.children[parseInt(e.target.dataset.index) + 1];
        if (next) next.focus();
    }
}

function onTokenKeydown(e) {
    if (e.key === 'Backspace' && !e.target.value && e.target.dataset.index > 0) {
        const prev = e.target.parentElement.children[parseInt(e.target.dataset.index) - 1];
        if (prev) { prev.focus(); prev.value = ''; }
    }
}

function getTokenValue() {
    const boxes = document.querySelectorAll('.token-box');
    return Array.from(boxes).map(b => b.value).join('');
}

//  MODAL: verificar 
async function submitVerify() {
    const code = getTokenValue();
    const errorEl = document.getElementById('modal-error');
    errorEl.classList.remove('visible');

    if (code.length !== tokenLength) {
        errorEl.textContent = `Ingrese los ${tokenLength} caracteres`;
        errorEl.classList.add('visible');
        return;
    }

    try {
        const res = await fetch(`${API}/${clientId}/verify/${code}`);
        const json = await res.json();

        if (res.ok) {
            // Token correcto ---→ animación de éxito
            document.querySelectorAll('.token-box').forEach(b => b.classList.add('success'));
            setTimeout(() => {
                closeModalSilent();
                goStep(4);
            }, 800);
        } else if (res.status === 429) {
            closeModalSilent();
            startCooldown(json.via_bloqueada, json.remaining_seconds, json.intentos);
        } else {
            currentAttempts = json.intentos || (currentAttempts + 1);
            document.querySelectorAll('.token-box').forEach(b => { b.classList.add('error'); b.value = ''; });
            setTimeout(() => document.querySelectorAll('.token-box').forEach(b => b.classList.remove('error')), 600);

            errorEl.textContent = json.error || 'Token incorrecto';
            errorEl.classList.add('visible');
            updateAttemptsBadge();
            updateSecurityBar();

            if (json.bloqueado) {
                setTimeout(() => {
                    closeModalSilent();
                    fetchCooldown();
                }, 1500);
            } else {
                document.querySelectorAll('.token-box')[0]?.focus();
            }
        }
    } catch (e) {
        errorEl.textContent = 'Error de conexión';
        errorEl.classList.add('visible');
    }
}

function updateAttemptsBadge() {
    const remaining = maxAttempts - currentAttempts;
    const badge = document.getElementById('attempts-badge');
    const text = document.getElementById('attempts-text');

    if (remaining <= 0) {
        badge.className = 'attempts-badge danger';
        text.textContent = '¡Sin intentos! Bloqueado.';
    } else if (remaining === 1) {
        badge.className = 'attempts-badge danger';
        text.textContent = `${remaining} intento restante`;
    } else {
        badge.className = 'attempts-badge';
        text.textContent = `${remaining} intentos restantes`;
    }
}

function updateSecurityBar() {
    const fill = document.getElementById('security-fill');
    const label = document.getElementById('security-label');
    const pct = Math.max(0, ((maxAttempts - currentAttempts) / maxAttempts) * 100);
    fill.style.width = pct + '%';

    if (pct > 66) { label.textContent = 'Strong'; label.style.color = 'var(--success)'; fill.style.background = 'linear-gradient(90deg, var(--accent), var(--success))'; }
    else if (pct > 33) { label.textContent = 'Medium'; label.style.color = 'var(--warning)'; fill.style.background = 'linear-gradient(90deg, var(--warning), var(--accent))'; }
    else { label.textContent = 'Weak'; label.style.color = 'var(--danger)'; fill.style.background = 'var(--danger)'; }
}

//  MODAL: cerrar / cancelar 
async function closeModal() {
    if (timerInterval) clearInterval(timerInterval);
    try { await fetch(`${API}/${clientId}/cancel`, { method: 'POST' }); } catch (e) { }
    document.getElementById('tokenModal').classList.remove('active');
    fetchCooldown();
}

function closeModalSilent() {
    if (timerInterval) clearInterval(timerInterval);
    document.getElementById('tokenModal').classList.remove('active');
}

async function cancelModal() {
    await closeModal();
}

async function resendToken() {
    closeModalSilent();
    try { await fetch(`${API}/${clientId}/cancel`, { method: 'POST' }); } catch (e) { }
    await new Promise(r => setTimeout(r, 200));
    submitStep2();
}

//  PASO 4: finalizar 
async function submitStep4() {
    const correo = document.getElementById('email').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return alert('Correo inválido');

    const dept = document.getElementById('dept').value.trim();
    const prov = document.getElementById('prov').value.trim();
    const dist = document.getElementById('dist').value.trim();
    if (!dept || !prov || !dist) return alert('Complete su ubicación');

    try {
        const res = await fetch(`${API}/${clientId}/finalize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, departamento: dept, provincia: prov, distrito: dist, acepto_terminos: true })
        });
        const json = await res.json();
        if (res.ok) goStep('success');
        else alert(json.error);
    } catch (e) { alert('Error de conexión'); }
}

//  TIMER (expiración del token en modal)
function startTimer(secs) {
    if (timerInterval) clearInterval(timerInterval);
    const end = Date.now() + secs * 1000;
    document.getElementById('btn-resend').disabled = true;

    timerInterval = setInterval(async () => {
        const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
        document.getElementById('timer-min').textContent = String(Math.floor(left / 60)).padStart(2, '0');
        document.getElementById('timer-sec').textContent = String(left % 60).padStart(2, '0');

        if (left <= 0) {
            clearInterval(timerInterval);
            document.getElementById('btn-resend').disabled = false;
            document.getElementById('expire-msg').classList.add('visible');
            try { await fetch(`${API}/${clientId}/expire`, { method: 'POST' }); } catch (e) { }
            setTimeout(() => {
                closeModalSilent();
                fetchCooldown();
            }, 3000);
        }
    }, 500);
}

//  COOLDOWN POR MEDIO (badges en radiobuttons)
async function fetchCooldown() {
    if (!clientId) return;
    try {
        const res = await fetch(`${API}/${clientId}/cooldown`);
        const json = await res.json();
        for (const via of ['S', 'W']) {
            const info = json.data[via];
            if (info && info.bloqueado && info.remaining_seconds > 0) {
                startCooldown(via, info.remaining_seconds, info.intentos);
            } else {
                clearCooldown(via);
            }
        }
    } catch (e) { }
}

function startCooldown(via, secs, intentos) {
    if (!secs) { fetchCooldown(); return; }
    cooldownState[via] = { blocked: true, remaining: secs };
    if (cooldownIntervals[via]) clearInterval(cooldownIntervals[via]);

    const end = Date.now() + secs * 1000;
    const badge = document.getElementById('cooldown-' + via);

    cooldownIntervals[via] = setInterval(() => {
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        cooldownState[via].remaining = left;
        const m = String(Math.floor(left / 60)).padStart(2, '0');
        const s = String(left % 60).padStart(2, '0');
        badge.textContent = `⏳ ${m}:${s}`;
        badge.classList.add('visible');

        if (left <= 0) { clearCooldown(via); }
        updateBtnState();
    }, 500);
    updateBtnState();
}

function clearCooldown(via) {
    if (cooldownIntervals[via]) { clearInterval(cooldownIntervals[via]); delete cooldownIntervals[via]; }
    cooldownState[via] = { blocked: false, remaining: 0 };
    document.getElementById('cooldown-' + via).classList.remove('visible');
    updateBtnState();
}

function updateBtnState() {
    const via = getVia();
    document.getElementById('btn-verificar').disabled = cooldownState[via].blocked;
}

function onViaChange() { updateBtnState(); }