const Party = (() => {
  'use strict';

  const groups = ['skills', 'feats', 'traits'];
  const attributes = [
    ['strength', 'Fuerza'], ['dexterity', 'Destreza'], ['constitution', 'Constitución'],
    ['intelligence', 'Inteligencia'], ['wisdom', 'Sabiduría'], ['cha', 'Carisma'],
  ];
  const spellLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const numberIn = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const text = value => value == null || typeof value === 'string';
  const validOptionalNumber = (value, min, max) => value == null || numberIn(value, min, max);

  function active(state) {
    return state.characters.find(character => character.id === state.activeCharacter && !character.archived) ??
      state.characters.find(character => !character.archived) ?? null;
  }

  function select(state, id) {
    const character = state.characters.find(item => item.id === id && !item.archived);
    if (character) state.activeCharacter = character.id;
    return character;
  }

  function newId() {
    return crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)),
      value => value.toString(16).padStart(2, '0')).join('');
  }

  function add(state, profile, { activate = true } = {}) {
    const character = { spells: [], spent: {}, lastRest: null, ...profile, id: newId() };
    state.characters.push(character);
    if (activate) select(state, character.id);
    return character;
  }

  function copy(state, source, suffix, activate = true) {
    const profile = JSON.parse(JSON.stringify(source));
    profile.name += suffix;
    if (activate) profile.archived = false;
    return add(state, profile, { activate });
  }

  function archive(state, character, archived) {
    character.archived = archived;
    state.activeCharacter = archived ? active(state)?.id ?? null : character.id;
  }

  function remove(state, id) {
    state.characters = state.characters.filter(character => character.id !== id);
    state.activeCharacter = active(state)?.id ?? null;
  }

  function validateExtension(character) {
    const hasEntries = group => character[group] === undefined || (
      Array.isArray(character[group]) && character[group].every(entry => entry && typeof entry.name === 'string' &&
        text(entry.notes) && validOptionalNumber(entry.level, 0, 99) &&
        validOptionalNumber(entry.ranks, 0, 99) && validOptionalNumber(entry.modifier, -99, 99))
    );
    const slotTotals = character.slotTotals;
    if (character.archived !== undefined && typeof character.archived !== 'boolean') return false;
    if (character.spellMode !== undefined && !['bard', 'manual'].includes(character.spellMode)) return false;
    if (slotTotals !== undefined && (!slotTotals || Array.isArray(slotTotals) || typeof slotTotals !== 'object' ||
      Object.entries(slotTotals).some(([level, total]) => !spellLevels.includes(Number(level)) || !numberIn(total, 0, 99)))) {
      return false;
    }
    return ['className', 'archetypes', 'ancestry', 'alignment', 'size', 'speed', 'sheetSource', 'sheetNotes']
      .every(field => text(character[field])) &&
      attributes.slice(0, -1).every(([field]) => validOptionalNumber(character[field], 1, 99)) &&
      validOptionalNumber(character.hpCurrent, -9999, 9999) && validOptionalNumber(character.hpMax, 0, 9999) &&
      validOptionalNumber(character.castingModifier, -99, 99) && groups.every(hasEntries) &&
      CombatData.validate(character) && LevelUp.validateReview(character.levelReview);
  }

  function supportsLegacy(character) {
    return !character.archived && character.spellMode !== 'manual' &&
      !Object.keys(character.slotTotals ?? {}).length && character.spells.every(spell => spell.l <= 6) &&
      !groups.some(group => character[group]?.length) &&
      !character.inventory?.length && !character.effects?.length && !character.combat && !character.levelReview;
  }

  return { groups, attributes, spellLevels, active, select, newId, add, copy, archive, remove, validateExtension, supportsLegacy };
})();
