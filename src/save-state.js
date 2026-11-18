const SaveState = (() => {
  'use strict';

  const SCHEMA = 2;
  const emptySpent = () => Object.fromEntries(Party.spellLevels.slice(0, 6).map(level => [level, 0]));
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isIntegerBetween = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

  function fresh() {
    return {
      schema: SCHEMA,
      activeCharacter: 'bard',
      characters: [{
        id: 'bard',
        name: 'Mi bardo',
        className: 'Bardo',
        level: 6,
        cha: 20,
        spellFocusEnchantment: true,
        spells: SpellCatalog.starterSpells(),
        spent: emptySpent(),
        lastRest: new Date().toISOString(),
      }],
    };
  }

  function validateProfiles(characters) {
    if (!Array.isArray(characters) || characters.some(character =>
      !isRecord(character) || typeof character.id !== 'string' || !character.id ||
      typeof character.name !== 'string' || !isIntegerBetween(character.level, 1, 20) ||
      !Number.isFinite(character.cha) || character.cha < 1 || character.cha > 99 ||
      !Party.validateExtension(character)
    )) {
      throw new Error('El respaldo tiene perfiles de personaje inválidos.');
    }

    if (new Set(characters.map(character => character.id)).size !== characters.length) {
      throw new Error('El respaldo contiene identificadores de personaje repetidos.');
    }
  }

  function validateSpellProgress({ spells, spent, lastRest }) {
    if (!Array.isArray(spells) || spells.some(spell =>
      !isRecord(spell) || typeof spell.id !== 'string' || typeof spell.name !== 'string' ||
      !isIntegerBetween(spell.l, 0, 9) ||
      ['desc', 'save', 'dice', 'source'].some(key => spell[key] != null && typeof spell[key] !== 'string')
    )) {
      throw new Error('El respaldo tiene un grimorio inválido.');
    }
    if (!isRecord(spent) || Object.values(spent).some(count => !Number.isSafeInteger(count) || count < 0)) {
      throw new Error('El respaldo tiene un contador de espacios inválido.');
    }
    if (lastRest != null && typeof lastRest !== 'string') {
      throw new Error('El respaldo tiene una fecha de descanso inválida.');
    }
  }

  function migrateLegacy(data, activeId) {
    const { spells, spent, lastRest, characters, ...metadata } = data;
    validateSpellProgress({ spells, spent, lastRest });

    return {
      ...metadata,
      schema: SCHEMA,
      activeCharacter: activeId,
      characters: characters.map(character => ({
        ...character,
        ...(character.id === activeId
          ? { spells, spent, lastRest: lastRest ?? null }
          : { spells: [], spent: emptySpent(), lastRest: null }),
      })),
    };
  }

  function parseBackup(json) {
    const data = JSON.parse(json);
    if (!isRecord(data) || (data.schema !== undefined && ![1, SCHEMA].includes(data.schema))) {
      throw new Error('La versión del respaldo es incompatible.');
    }

    validateProfiles(data.characters);
    if (data.schema !== SCHEMA) {
      const loaded = data.characters.find(character => character.id === data.activeCharacter) ?? data.characters[0];
      if (!loaded) throw new Error('El respaldo anterior no tiene ningún perfil.');
      const migrated = migrateLegacy(data, loaded.id);
      return { ...migrated, activeCharacter: Party.active(migrated)?.id ?? null };
    }

    data.characters.forEach(validateSpellProgress);
    return { ...data, activeCharacter: Party.active(data)?.id ?? null };
  }

  function serializeBackup(state) {
    if (state.characters.length !== 1 || !Party.supportsLegacy(state.characters[0])) {
      return JSON.stringify(state, null, 2);
    }

    // El formato anterior puede representar todo el progreso de una sola ficha.
    const { spells, spent, lastRest, ...profile } = state.characters[0];
    return JSON.stringify({
      ...state,
      schema: 1,
      characters: [profile],
      spells,
      spent,
      lastRest,
    }, null, 2);
  }

  function changeSpent(character, level, delta) {
    const spent = character.spent[level] || 0;
    const next = spent + delta;
    if (delta < 0 || next <= BardRules.totalSlots(character, level)) {
      character.spent[level] = Math.max(0, next);
    }
  }

  function rest(character) {
    character.spent = emptySpent();
    character.lastRest = new Date().toISOString();
  }

  return { fresh, activeCharacter: Party.active, parseBackup, serializeBackup, changeSpent, rest };
})();
