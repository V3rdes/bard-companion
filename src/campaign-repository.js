const CampaignRepository = (() => {
  'use strict';

  function create(client, campaignId, getStorage = () => window.localStorage) {
    const selectionKey = 'bard-companion:active:' + campaignId;
    let snapshot = new Map();

    async function load() {
      const { data, error } = await client.from('campaign_characters').select('sheet, revision')
        .eq('campaign_id', campaignId).order('id');
      if (error) throw error;
      let activeCharacter = null;
      try { activeCharacter = getStorage().getItem(selectionKey); } catch {}
      const state = SaveState.parseBackup(JSON.stringify({
        schema: 2,
        activeCharacter,
        characters: data.map(row => row.sheet),
      }));
      snapshot = new Map(data.map(row => [row.sheet.id, {
        json: JSON.stringify(row.sheet),
        revision: row.revision,
      }]));
      return state;
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
          else snapshot.set(change.id, { json: next.get(change.id), revision: revisions.get(change.id) });
        }
      }

      try {
        if (state.activeCharacter === null) getStorage().removeItem(selectionKey);
        else getStorage().setItem(selectionKey, state.activeCharacter);
      } catch {}
      return true;
    }

    return { load, save: state => write(state), replace: state => write(state, true) };
  }

  return { create };
})();
