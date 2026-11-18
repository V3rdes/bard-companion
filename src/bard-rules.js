const BardRules = (() => {
  const BASE_SLOTS = {
    1: [1,0,0,0,0,0],
    2: [2,0,0,0,0,0],
    3: [3,0,0,0,0,0],
    4: [3,1,0,0,0,0],
    5: [4,2,0,0,0,0],
    6: [4,3,0,0,0,0],
    7: [4,3,1,0,0,0],
    8: [4,4,2,0,0,0],
    9: [5,4,3,0,0,0],
    10: [5,4,3,1,0,0],
    11: [5,4,4,2,0,0],
    12: [5,5,4,3,0,0],
    13: [5,5,4,3,1,0],
    14: [5,5,4,4,2,0],
    15: [5,5,5,4,3,0],
    16: [5,5,5,4,3,1],
    17: [5,5,5,4,4,2],
    18: [5,5,5,5,4,3],
    19: [5,5,5,5,5,4],
    20: [5,5,5,5,5,5],
  };
  const KNOWN = {
    1: [4,2,0,0,0,0,0],
    2: [5,3,0,0,0,0,0],
    3: [6,4,0,0,0,0,0],
    4: [6,4,2,0,0,0,0],
    5: [6,4,3,0,0,0,0],
    6: [6,4,4,0,0,0,0],
    7: [6,5,4,2,0,0,0],
    8: [6,5,4,3,0,0,0],
    9: [6,5,4,4,0,0,0],
    10: [6,5,5,4,2,0,0],
    11: [6,6,5,4,3,0,0],
    12: [6,6,5,4,4,0,0],
    13: [6,6,5,5,4,2,0],
    14: [6,6,6,5,4,3,0],
    15: [6,6,6,5,4,4,0],
    16: [6,6,6,5,5,4,2],
    17: [6,6,6,6,5,4,3],
    18: [6,6,6,6,5,4,4],
    19: [6,6,6,6,5,5,4],
    20: [6,6,6,6,6,5,5],
  };

  function charismaModifier(character) {
    return Math.floor((character.cha - 10) / 2);
  }

  function totalSlots(character, level) {
    const manual = character.slotTotals?.[level];
    if (manual !== undefined) return manual;
    if (character.spellMode === 'manual') return 0;
    const base = BASE_SLOTS[character.level]?.[level - 1] || 0;
    if (!base) return 0;

    const modifier = charismaModifier(character);
    const bonus = modifier >= level ? 1 + Math.floor((modifier - level) / 4) : 0;
    return base + bonus;
  }

  function remainingSlots(character, level) {
    return Math.max(0, totalSlots(character, level) - (character.spent[level] || 0));
  }

  function pendingSpells(character, level) {
    if (character.spellMode === 'manual') return 0;
    const expected = KNOWN[character.level]?.[level] || 0;
    const count = character.spells.filter(spell => spell.l === level).length;
    return Math.max(0, expected - count);
  }

  function spellDC(character, spell, modifier = character.spellMode === 'manual' ? character.castingModifier : charismaModifier(character)) {
    const save = (spell.save ?? '').toLowerCase();
    if (save === 'ninguna' || save.startsWith('no')) return null;
    if (modifier == null) return null;
    const focus = character.spellFocusEnchantment && spell.school === 'Encantamiento' ? 1 : 0;
    return { total: 10 + spell.l + modifier + focus, modifier, focus };
  }

  function formatDice(character, guide) {
    const level = character.level;
    return guide
      .replaceAll('{{LEVEL}}', String(level))
      .replaceAll('{{EAR_DICE}}', `${Math.min(5, Math.ceil(level / 2))}d6`)
      .replaceAll('{{IMAGE_BONUS}}', String(Math.floor(level / 3)));
  }

  return { totalSlots, remainingSlots, pendingSpells, spellDC, formatDice };
})();
