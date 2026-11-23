const CampaignRepository = (() => {
  'use strict';

  function create(client, campaignId, getStorage = () => window.localStorage, getSessionStorage = () => window.sessionStorage) {
    const selectionKey = 'bard-companion:active:' + campaignId;
    let tabId = 'default';
    try {
      const session = getSessionStorage();
      tabId = session.getItem('bard-companion:tab') || Party.newId();
      session.setItem('bard-companion:tab', tabId);
    } catch {}
    const draftKey = 'bard-companion:pending:' + campaignId + ':' + tabId;
    let snapshot = new Map();

    async function fetchLatest() {
      const { data, error } = await client.from('campaign_characters').select('sheet, revision, updated_at')
        .eq('campaign_id', campaignId).order('id');
      if (error) throw error;
      let activeCharacter = null;
      try { activeCharacter = getStorage().getItem(selectionKey); } catch {}
      const state = SaveState.parseBackup(JSON.stringify({
        schema: 2,
        activeCharacter,
        characters: data.map(row => row.sheet),
      }));
      return { state, rows: data };
    }

    function adopt(latest) {
      snapshot = new Map(latest.rows.map(row => [row.sheet.id, {
        json: JSON.stringify(row.sheet), revision: row.revision, updatedAt: row.updated_at,
      }]));
      return latest.state;
    }

    async function load() {
      return adopt(await fetchLatest());
    }

    function changed(latest) {
      return latest.rows.length !== snapshot.size || latest.rows.some(row => snapshot.get(row.sheet.id)?.revision !== row.revision);
    }

    async function rebase(state, options) {
      const latest = await fetchLatest();
      const base = { characters: [...snapshot.values()].map(row => JSON.parse(row.json)) };
      const merged = SyncState.merge(base, state, latest.state, options);
      if (!merged.conflicts.length) adopt(latest);
      return merged;
    }

    function persistDraft(state) {
      try { getStorage().setItem(draftKey, JSON.stringify({ state, base: [...snapshot] })); return true; }
      catch { return false; }
    }

    function resumeDraft() {
      const raw = getStorage().getItem(draftKey);
      if (!raw) return null;
      const draft = JSON.parse(raw);
      const state = SaveState.parseBackup(JSON.stringify(draft.state));
      if (!Array.isArray(draft.base)) throw new Error('El borrador pendiente no se pudo validar.');
      snapshot = new Map(draft.base);
      return state;
    }

    function clearDraft() {
      try { getStorage().removeItem(draftKey); } catch {}
    }

    async function write(state, replace = false) {
      const next = new Map(state.characters.map(sheet => [sheet.id, JSON.stringify(sheet)]));
      const changes = [];
      for (const sheet of state.characters) {
        const previous = snapshot.get(sheet.id);
        if (replace || next.get(sheet.id) !== previous?.json) {
          changes.push({ id: sheet.id, sheet, revision: previous?.revision ?? null });
        }
      }
      for (const [id, previous] of snapshot) {
        if (!next.has(id)) changes.push({ id, sheet: null, revision: previous.revision });
      }

      if (changes.length || replace) {
        const parameters = { p_campaign_id: campaignId, p_changes: changes };
        if (replace) {
          parameters.p_expected_ids = Array.from(snapshot.keys());
        }
        const { data, error } = await client.rpc('save_campaign_sheets', parameters);
        if (error?.code === '40001') return false;
        if (error) throw error;

        const revisions = new Map(data.map(row => [row.id, row.revision]));
        for (const change of changes) {
          if (!change.sheet) snapshot.delete(change.id);
          else snapshot.set(change.id, { json: next.get(change.id), revision: revisions.get(change.id), updatedAt: new Date().toISOString() });
        }
      }

      try {
        if (state.activeCharacter === null) getStorage().removeItem(selectionKey);
        else getStorage().setItem(selectionKey, state.activeCharacter);
      } catch {}
      return true;
    }

    return { load, fetchLatest, adopt, changed, rebase, persistDraft, resumeDraft, clearDraft,
      updatedAt: id => snapshot.get(id)?.updatedAt,
      save: state => write(state), replace: state => write(state, true) };
  }

  return { create };
})();
