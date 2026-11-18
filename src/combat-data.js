const CombatData = (() => {
  'use strict';

  const sources = { spell: 'Conjuro', feat: 'Dote', trait: 'Rasgo o aptitud', item: 'Equipo', other: 'Otro efecto' };
  const record = value => value != null && typeof value === 'object' && !Array.isArray(value);
  const optional = (value, validate) => value == null || validate(value);
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const isNumber = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  const has = (options, key) => Object.prototype.hasOwnProperty.call(options, key);

  function optionalFields(value, names, validate) {
    return names.every(name => optional(value[name], validate));
  }

  function validateInventory(inventory) {
    if (!Array.isArray(inventory) || !inventory.every(item => record(item) &&
      typeof item.id === 'string' && item.id.length > 0 && typeof item.name === 'string' && has(CombatRules.categories, item.kind) &&
      integer(item.quantity, 1, 999999) && typeof item.carried === 'boolean' && typeof item.equipped === 'boolean' &&
      optionalFields(item, ['weight', 'price'], value => isNumber(value, 0, 1e9)) &&
      optionalFields(item, ['enhancement', 'damageCap', 'acBonus', 'dexCap'], value => integer(value, 0, 99)) &&
      optionalFields(item, ['attackAdjustment', 'damageAdjustment'], value => integer(value, -99, 99)) &&
      optionalFields(item, ['proficient', 'masterwork', 'singleAttack', 'slows', 'touchAttack', 'fixedRange', 'criticalDisabled', 'standardActionAttack'], value => typeof value === 'boolean') &&
      optionalFields(item, ['charges', 'chargesMax', 'reach'], value => integer(value, 0, 9999)) &&
      (item.charges == null || item.chargesMax == null || item.charges <= item.chargesMax) &&
      optional(item.armorCategory, value => ['light', 'medium', 'heavy'].includes(value)) &&
      optionalFields(item, ['notes', 'url', 'slot', 'damageType', 'ammunition'], value => typeof value === 'string') &&
      optionalFields(item, ['attackAbility', 'damageAbility'], value => has(CombatRules.attributes, value)) &&
      optional(item.mode, value => has(CombatRules.modes, value)) &&
      optional(item.damageMode, value => has(CombatRules.damageModes, value)) &&
      optional(item.damageDice, value => typeof value === 'string') &&
      optional(item.checkPenalty, value => integer(value, -99, 0)) &&
      optional(item.arcaneFailure, value => integer(value, 0, 100)) &&
      optional(item.range, value => integer(value, 0, 9999)) &&
      optional(item.critMin, value => integer(value, 1, 20)) &&
      optional(item.critMultiplier, value => integer(value, 2, 9))
    )) return false;
    return new Set(inventory.map(item => item.id)).size === inventory.length;
  }

  function validateEffects(effects) {
    return Array.isArray(effects) && effects.every(effect => record(effect) && typeof effect.name === 'string' &&
      typeof effect.active === 'boolean' && has(sources, effect.sourceKind) &&
      optionalFields(effect, ['source', 'equipmentId', 'duration', 'notes', 'url'], value => typeof value === 'string') &&
      Array.isArray(effect.modifiers) && effect.modifiers.every(modifier => record(modifier) &&
        has(CombatRules.types, modifier.type) && integer(modifier.value, -99, 99) &&
        typeof modifier.target === 'string' &&
        (has(CombatRules.targets, modifier.target) || /^skill:.+/.test(modifier.target))));
  }

  function validateSettings(settings) {
    return record(settings) && optional(settings.progression, value => ['manual', 'class'].includes(value)) &&
      optionalFields(settings, ['bab', ...Object.keys(CombatRules.savingThrows)], value => integer(value, 0, 99)) &&
      optional(settings.landSpeed, value => integer(value, 0, 9999)) &&
      optional(settings.referenceTotals, value => record(value) &&
        optionalFields(value, Object.keys(CombatRules.referenceStats), total => integer(total, -9999, 9999))) &&
      optionalFields(settings, ['ignoreSpeed', 'coinsCarried', 'quadruped'], value => typeof value === 'boolean') &&
      optional(settings.money, value => record(value) &&
        optionalFields(value, Object.keys(CombatRules.coins), count => integer(count, 0, 99999999)));
  }

  function validate(character) {
    return optional(character.inventory, validateInventory) && optional(character.effects, validateEffects) &&
      optional(character.castingAbility, value => has(CombatRules.attributes, value)) &&
      optional(character.combat, validateSettings) && ['skills', 'feats', 'traits'].every(group => (character[group] ?? []).every(entry =>
        optional(entry.url, value => typeof value === 'string'))) && (character.skills ?? []).every(skill =>
        optional(skill.ability, value => has(CombatRules.attributes, value)) &&
        optionalFields(skill, ['classSkill', 'ignoreArmor', 'trainedOnly'], value => typeof value === 'boolean'));
  }

  function putItem(character, item) {
    const replacesProtection = item.equipped && ['armor', 'shield'].includes(item.kind);
    const inventory = (character.inventory ?? []).map(previous => {
      if (previous.id === item.id) return item;
      if (replacesProtection && previous.kind === item.kind && previous.equipped) return { ...previous, equipped: false };
      return previous;
    });
    if (!inventory.some(previous => previous.id === item.id)) inventory.push(item);
    character.inventory = inventory;
  }

  return { sources, validate, putItem };
})();
