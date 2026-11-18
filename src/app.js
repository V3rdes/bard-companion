'use strict';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
const CAMPAIGN_HASH = '#campana';
const byId = id => document.getElementById(id);

function navigateTo(hash) {
  location.hash = hash;
  location.reload();
}

async function startCampaign() {
  const workspace = byId('app-workspace');
  const login = byId('campaign-login');
  const status = byId('campaign-status');
  const submit = byId('campaign-submit');
  const openLocal = byId('open-local');
  const signOut = byId('close-campaign');
  const reload = byId('reload-campaign');
  let ui;

  function leave(hash) {
    ui?.allowNavigation();
    navigateTo(hash);
  }

  byId('open-campaign').classList.add('hidden');
  byId('hero-subtitle').textContent = '';
  workspace.hidden = true;
  openLocal.classList.remove('hidden');
  openLocal.onclick = () => {
    if (!ui || ui.canLeave()) leave('');
  };
  byId('campaign-auth').hidden = false;
  status.textContent = 'Conectando con Supabase…';

  try {
    const { createClient } = await import(SDK_URL);
    const client = createClient(CampaignConfig.url, CampaignConfig.publishableKey, {
      auth: { detectSessionInUrl: false },
    });

    async function openWorkspace() {
      login.hidden = true;
      signOut.classList.remove('hidden');
      status.textContent = 'Cargando fichas de la mesa…';
      const { data: campaigns, error } = await client.from('campaigns').select('id, name');
      if (error) throw error;
      if (campaigns.length !== 1) {
        status.textContent = 'La cuenta de la mesa debe estar vinculada a una campaña.';
        return;
      }
      const campaign = campaigns[0];
      const repository = CampaignRepository.create(client, campaign.id);
      const state = await repository.load();
      byId('campaign-auth').hidden = true;
      byId('save-location').textContent = 'Campaña compartida · ' + campaign.name;
      workspace.hidden = false;
      reload.classList.remove('hidden');
      ui = BardUI.mount(repository, { campaignState: state });
    }

    signOut.onclick = async () => {
      if (ui && !ui.canLeave()) return;
      signOut.disabled = true;
      workspace.inert = true;
      byId('modal-root').inert = true;
      try {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
        leave('');
      } catch {
        alert('No se pudo cerrar la sesión. Volvé a intentar.');
      } finally {
        signOut.disabled = false;
        workspace.inert = false;
        byId('modal-root').inert = false;
      }
    };
    reload.onclick = () => {
      if (ui.canLeave()) leave(CAMPAIGN_HASH);
    };

    login.onsubmit = async event => {
      event.preventDefault();
      const email = byId('campaign-email').value.trim();
      const password = byId('campaign-password').value;
      submit.disabled = true;
      status.textContent = 'Entrando…';
      try {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          status.textContent = 'No se pudo entrar. Revisá el correo, la contraseña y la conexión.';
          return;
        }
        byId('campaign-password').value = '';
        await openWorkspace();
      } catch {
        status.textContent = 'No se pudo abrir la campaña. Revisá la conexión y recargá.';
      } finally {
        submit.disabled = false;
      }
    };

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) await openWorkspace();
    else {
      status.textContent = 'Entrá con el correo y la contraseña compartidos por la mesa.';
      login.hidden = false;
    }
  } catch {
    status.textContent = 'No se pudo conectar con la campaña. Revisá la conexión o abrí las fichas locales.';
  }
}

const campaignConfigured = location.protocol.startsWith('http') &&
  CampaignConfig.url.startsWith('https://') && CampaignConfig.publishableKey.startsWith('sb_publishable_');

if (campaignConfigured) {
  byId('campaign-bar').classList.remove('hidden');
  byId('open-campaign').onclick = () => navigateTo(CAMPAIGN_HASH);
}
if (campaignConfigured && location.hash === CAMPAIGN_HASH) startCampaign();
else BardUI.mount(LocalRepository.create());

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
