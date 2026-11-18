const LocalRepository = (() => {
  'use strict';

  const KEY = 'bard-companion:save:v2';
  const LEGACY_KEY = 'bard-companion:save:v1';

  function checkpoint(current) {
    try {
      return JSON.parse(current)?.legacyCheckpoint;
    } catch {
      return undefined;
    }
  }

  function create(getStorage = () => window.localStorage) {
    let snapshot;

    function read(storage) {
      const current = storage.getItem(KEY);
      const legacy = storage.getItem(LEGACY_KEY);
      return { current, legacy };
    }

    function load() {
      snapshot = undefined;
      const data = read(getStorage());
      const raw = data.current ?? data.legacy;
      const { legacyCheckpoint, ...state } = raw === null ? {} : SaveState.parseBackup(raw);
      snapshot = { ...data, checkpoint: data.current === null ? data.legacy : legacyCheckpoint };
      return raw === null ? null : state;
    }

    function write(storage, state, legacy, acceptedLegacy) {
      const current = JSON.stringify({ ...state, legacyCheckpoint: acceptedLegacy });
      storage.setItem(KEY, current);
      snapshot = { current, legacy, checkpoint: acceptedLegacy };
    }

    function save(state, recoveredLegacy) {
      if (!snapshot) return false;

      const storage = getStorage();
      const latest = read(storage);
      if (latest.current !== snapshot.current) return false;
      if (snapshot.current === null && latest.legacy !== snapshot.legacy) return false;
      if (recoveredLegacy !== undefined && latest.legacy !== recoveredLegacy) return false;

      write(storage, state, latest.legacy, recoveredLegacy ?? snapshot.checkpoint);
      return true;
    }

    // La importación confirmada reemplaza el guardado actual, incluso si era ilegible.
    function replace(state) {
      const storage = getStorage();
      const { current, legacy } = read(storage);
      write(storage, state, legacy, current === null ? legacy : checkpoint(current));
    }

    function pendingLegacy() {
      if (!snapshot || snapshot.current === null) return null;
      const legacy = getStorage().getItem(LEGACY_KEY);
      return legacy === snapshot.checkpoint ? null : legacy;
    }

    return { load, save, replace, pendingLegacy };
  }

  return { create };
})();
