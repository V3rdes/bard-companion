'use strict';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
const PUBLIC_APP_URL = 'https://v3rdes.github.io/bard-companion/#campana';
const byId = id => document.getElementById(id);
let activeUI;
let client;
let opening = false;
let sdkAttempt = 0;

function syncStatus(text) { byId('sync-status').textContent = text; }

async function startCampaign() {
  if (opening || activeUI) return;
  const login = byId('campaign-login');
  const status = byId('campaign-status');
  const submit = byId('campaign-submit');
  byId('campaign-auth').hidden = false;
  if (navigator.onLine === false) {
    syncStatus('Sin conexión · La campaña se abrirá automáticamente al volver a conectarte.');
    return;
  }
  opening = true;
  try {
    status.textContent = 'Conectando con la campaña…';
    if (!client) {
      const { createClient } = await import(SDK_URL + (sdkAttempt++ ? '?retry=' + sdkAttempt : ''));
      client = createClient(CampaignConfig.url, CampaignConfig.publishableKey, {
        auth: { detectSessionInUrl: false },
      });
    }

    async function openWorkspace() {
      const { data: campaigns, error } = await client.from('campaigns').select('id, name');
      if (error) throw error;
      if (campaigns.length !== 1) throw new Error('La cuenta debe estar vinculada a una sola campaña.');
      const campaign = campaigns[0];
      const repository = CampaignRepository.create(client, campaign.id);
      const state = await repository.load();
      let pending;
      try { pending = repository.resumeDraft(); } catch {
        byId('storage-warning').textContent = 'Hay un borrador anterior que no se pudo abrir. Se conserva en este navegador.';
        byId('storage-warning').classList.remove('hidden');
      }
      login.hidden = true;
      byId('campaign-auth').hidden = true;
      byId('save-location').textContent = 'Campaña compartida · ' + campaign.name;
      byId('app-workspace').hidden = false;
      byId('close-campaign').classList.remove('hidden');
      activeUI = BardUI.mount(repository, {
        campaignState: pending ?? state, hasPending: Boolean(pending), onSyncStatus: syncStatus,
      });
    }

    login.onsubmit = async event => {
      event.preventDefault();
      if (opening) return;
      opening = true;
      submit.disabled = true;
      status.textContent = 'Entrando…';
      try {
        const { error } = await client.auth.signInWithPassword({
          email: byId('campaign-email').value.trim(), password: byId('campaign-password').value,
        });
        if (error) throw error;
        byId('campaign-password').value = '';
        await openWorkspace();
      } catch {
        status.textContent = 'No se pudo entrar. Revisá el correo, la contraseña y la conexión.';
      } finally { opening = false; submit.disabled = false; }
    };
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) await openWorkspace();
    else {
      status.textContent = 'Usá la cuenta compartida de la mesa. Vas a ver las mismas fichas en todos tus dispositivos.';
      syncStatus('Una campaña · Guardado compartido entre dispositivos');
      login.hidden = false;
    }
  } catch {
    status.textContent = 'No se pudo conectar. Reintentando automáticamente…';
    syncStatus('Esperando conexión con la campaña');
  } finally { opening = false; }
}

byId('close-campaign').onclick = async () => {
  if (activeUI && !activeUI.canLeave()) return;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    activeUI?.allowNavigation();
    location.reload();
  } catch { syncStatus('No se pudo cerrar la sesión. Revisá la conexión.'); }
};

const configured = CampaignConfig.url.startsWith('https://') && CampaignConfig.publishableKey.startsWith('sb_publishable_');
if (location.protocol.startsWith('http') && configured) {
  // La URL normal, los enlaces antiguos y la PWA siempre abren la misma campaña.
  history.replaceState(null, '', location.pathname + location.search + '#campana');
  byId('campaign-bar').classList.remove('hidden');
  byId('open-campaign').classList.add('hidden');
  startCampaign();
  const retry = setInterval(() => {
    if (!document.hidden && !activeUI && byId('campaign-login').hidden) startCampaign();
  }, 10000);
  window.addEventListener('online', startCampaign);
  window.addEventListener('focus', startCampaign);
  window.addEventListener('pagehide', () => clearInterval(retry), { once: true });
} else if (location.protocol === 'file:') {
  if (location.hash === '#respaldo') {
    byId('campaign-auth').hidden = false;
    byId('campaign-title').textContent = 'Recuperar respaldo anterior';
    byId('campaign-status').textContent = 'Podés exportar los datos antiguos de este archivo. La ficha que se usa ahora está en la campaña compartida.';
    byId('campaign-bar').classList.remove('hidden');
    byId('open-campaign').textContent = 'Abrir app compartida';
    byId('open-campaign').onclick = () => location.assign(PUBLIC_APP_URL);
  } else {
    syncStatus('Abriendo la campaña compartida…');
    location.replace(PUBLIC_APP_URL);
  }
} else {
  byId('campaign-auth').hidden = false;
  byId('campaign-status').textContent = 'Falta configurar la conexión de la campaña.';
}

// Las fichas antiguas nunca se borran ni se mezclan a ciegas con la campaña.
try {
  const raw = localStorage.getItem('bard-companion:save:v2') ?? localStorage.getItem('bard-companion:save:v1');
  if (raw !== null) {
    byId('browser-backup').hidden = false;
    byId('export-browser-backup').onclick = () => {
      const link = document.createElement('a');
      const latest = localStorage.getItem('bard-companion:save:v2') ?? localStorage.getItem('bard-companion:save:v1') ?? raw;
      const url = URL.createObjectURL(new Blob([latest], { type: 'application/json' }));
      link.href = url;
      link.download = 'bard-companion-respaldo-anterior.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
} catch {}

AppUpdates.start({
  canReload: () => activeUI ? activeUI.safeToReload() :
    !byId('campaign-email').value && !byId('campaign-password').value,
  onWaiting: () => {
    byId('app-update-status').classList.remove('hidden');
    byId('app-update-status').textContent = 'Actualización en espera · Tu edición y guardado se conservan.';
  },
  onReload: () => activeUI?.prepareReload(),
});
