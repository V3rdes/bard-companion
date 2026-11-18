const CombatRules = (() => {
  'use strict';

  const attributes = Object.fromEntries(Party.attributes);
  const savingThrows = { fortitude: 'Fortaleza', reflex: 'Reflejos', will: 'Voluntad' };
  const referenceStats = {
    ac: 'CA', touch: 'Toque', flat: 'Desprevenido', initiative: 'Iniciativa',
    ...savingThrows, cmb: 'BMC', cmd: 'DMC',
  };
  const saveAbilities = { fortitude: 'constitution', reflex: 'dexterity', will: 'wisdom' };
  const categories = { equipment: 'Objeto', weapon: 'Arma', armor: 'Armadura', shield: 'Escudo' };
  const types = {
    untyped: 'Sin tipo', alchemical: 'Alquímico', armor: 'Armadura', circumstance: 'Circunstancia',
    competence: 'Competencia', deflection: 'Desvío', dodge: 'Esquiva', enhancement: 'Mejora',
    inherent: 'Inherente', insight: 'Intuición', luck: 'Suerte', morale: 'Moral',
    naturalArmor: 'Armadura natural', naturalEnhancement: 'Mejora de armadura natural',
    profane: 'Profano', racial: 'Racial', resistance: 'Resistencia', sacred: 'Sagrado',
    shield: 'Escudo', size: 'Tamaño', trait: 'Rasgo',
  };
  const targets = {
    ac: 'CA', touch: 'CA de toque', flat: 'CA desprevenido', initiative: 'Iniciativa',
    attack: 'Ataque (todos)', melee: 'Ataque cuerpo a cuerpo', ranged: 'Ataque a distancia',
    damage: 'Daño', saves: 'Salvaciones (todas)', ...savingThrows, cmb: 'BMC', cmd: 'DMC',
    skills: 'Habilidades (todas)', spellDc: 'CD de conjuros', extraAttack: 'Ataques adicionales en ataque completo',
    ...Object.fromEntries(Party.attributes.map(([key, label]) => ['ability:' + key, label + ' (puntuación)'])),
  };
  const modes = { melee: 'Cuerpo a cuerpo', thrown: 'Arrojadiza', ranged: 'A distancia' };
  const damageModes = {
    full: 'Modificador completo', twoHands: 'A dos manos (×1,5)', offHand: 'Mano torpe (×½)',
    none: 'Sin modificador', penalty: 'Solo penalizador', limited: 'Con tope (arco compuesto)',
    sheet: 'Total de la hoja (incluye atributo y mejora)',
  };
  const coins = { pp: 'Platino', gp: 'Oro', sp: 'Plata', cp: 'Cobre' };
  const classProgressions = [
    [['barbaro', 'barbarian', 'guerrero', 'fighter'], 1, ['fortitude']],
    [['paladin'], 1, ['fortitude', 'will']],
    [['explorador', 'guardabosques', 'ranger'], 1, ['fortitude', 'reflex']],
    [['bardo', 'bard'], 0.75, ['reflex', 'will']],
    [['clerigo', 'cleric', 'druida', 'druid'], 0.75, ['fortitude', 'will']],
    [['monje', 'monk'], 0.75, ['fortitude', 'reflex', 'will']],
    [['picaro', 'rogue'], 0.75, ['reflex']],
    [['hechicero', 'sorcerer', 'mago', 'wizard'], 0.5, ['will']],
  ];
  const sizes = [
    [['fino', 'fine'], 8, 1 / 8, 1 / 4],
    [['diminuto', 'diminuta', 'diminutive'], 4, 1 / 4, 1 / 2],
    [['menudo', 'menuda', 'tiny'], 2, 1 / 2, 3 / 4],
    [['pequeno', 'pequena', 'small'], 1, 3 / 4, 1],
    [['mediano', 'mediana', 'medium'], 0, 1, 1.5],
    [['grande', 'large'], -1, 2, 3],
    [['enorme', 'huge'], -2, 4, 6],
    [['gargantuesco', 'gargantuan'], -4, 8, 12],
    [['colosal', 'colossal'], -8, 16, 24],
  ];
  const loads = [
    [0, 0, 0], [3, 6, 10], [6, 13, 20], [10, 20, 30], [13, 26, 40], [16, 33, 50],
    [20, 40, 60], [23, 46, 70], [26, 53, 80], [30, 60, 90], [33, 66, 100],
    [38, 76, 115], [43, 86, 130], [50, 100, 150], [58, 116, 175], [66, 133, 200],
    [76, 153, 230], [86, 173, 260], [100, 200, 300], [116, 233, 350], [133, 266, 400],
    [153, 306, 460], [173, 346, 520], [200, 400, 600], [233, 466, 700], [266, 533, 800],
    [306, 613, 920], [346, 693, 1040], [400, 800, 1200], [466, 933, 1400],
  ];
  const cmdTypes = new Set(['circumstance', 'deflection', 'dodge', 'insight', 'luck', 'morale', 'profane', 'sacred']);
  const touchExcluded = new Set(['armor', 'shield', 'naturalArmor', 'naturalEnhancement']);
  const stackable = new Set(['untyped', 'dodge', 'circumstance', 'racial']);
  const normalize = text => String(text ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const skillTarget = name => 'skill:' + normalize(name);
  const mod = value => value == null ? null : Math.floor((value - 10) / 2);
  const part = (label, value) => ({ label, value });
  const sum = parts => parts.some(({ value }) => value == null) ? null : parts.reduce((total, item) => total + item.value, 0);
  const round = value => Number(value.toFixed(6));
  const signed = value => value >= 0 ? '+' + value : '−' + Math.abs(value);
  const expression = (dice, value) => value == null || !dice ? '—' : value === 0
    ? dice : dice + (value < 0 ? ' − ' : ' + ') + Math.abs(value);

  function apply(parts, candidates = []) {
    const winners = new Map();
    const ignored = [];
    for (const candidate of candidates) {
      if (!candidate.value) continue;
      const positive = candidate.value > 0;
      const separateSource = !positive || stackable.has(candidate.type);
      const source = separateSource ? normalize(candidate.source || candidate.label) : '';
      const key = JSON.stringify([candidate.type, positive, source]);
      const previous = winners.get(key);
      const better = !previous || Math.abs(candidate.value) > Math.abs(previous.value);
      if (better) {
        if (previous) ignored.push(previous);
        winners.set(key, candidate);
      } else ignored.push(candidate);
    }
    const applied = [...parts, ...winners.values()];
    return { total: sum(applied), applied, ignored };
  }

  function getEffects(character) {
    const equipped = new Set((character.inventory ?? []).filter(item => item.equipped).map(item => item.id));
    return (character.effects ?? [])
      .filter(effect => effect.active && (!effect.equipmentId || equipped.has(effect.equipmentId)))
      .flatMap(effect => effect.modifiers.map(modifier => ({
        ...modifier, label: effect.name, source: effect.source || effect.name,
      })));
  }

  function classProgression(character) {
    const overrides = character.combat ?? {};
    const profile = overrides.progression === 'manual' ? undefined :
      classProgressions.find(([names]) => names.includes(normalize(character.className)));
    const fallback = profile ?? [[], null, []];
    const [, rate, good] = fallback;
    const bab = overrides.bab ?? (rate == null ? null : Math.floor(rate * character.level));
    const saves = Object.fromEntries(Object.keys(savingThrows).map(key => [
      key,
      overrides[key] ?? (profile ? (good.includes(key) ? 2 + Math.floor(character.level / 2) : Math.floor(character.level / 3)) : null),
    ]));
    return { bab, saves };
  }

  function carryingCapacity(strength, factor) {
    if (strength == null || factor == null) return null;
    if (strength <= 0) return loads[0];
    const scale = Math.max(0, Math.floor((strength - 20) / 10));
    return loads[strength - scale * 10].map(value => value * factor * 4 ** scale);
  }

  function load(character, strength, size) {
    const settings = character.combat ?? {};
    const money = Object.keys(coins).reduce((count, coin) => count + (settings.money?.[coin] ?? 0), 0);
    const coinWeight = settings.coinsCarried === false ? 0 : money / 50;
    const carriedItems = (character.inventory ?? []).filter(item => item.carried || item.equipped);
    const missingWeights = carriedItems.filter(item => item.weight == null).map(item => item.name);
    const items = carriedItems.map(item => part(item.name, round(item.quantity * (item.weight ?? 0))));
    const weightParts = [...items, part('Monedas llevadas', coinWeight)];
    const weight = round(sum(weightParts));
    const factor = size?.[settings.quadruped ? 3 : 2];
    const limits = carryingCapacity(strength, factor);
    const tier = !limits ? 'Sin calcular' : weight <= limits[0] ? 'Ligera' : weight <= limits[1] ? 'Media' :
      weight <= limits[2] ? 'Pesada' : weight <= limits[2] * 2 ? 'Sobrecarga' : 'Excede el doble de la carga máxima';
    const overloaded = tier === 'Sobrecarga' || tier.startsWith('Excede');
    const dexCap = overloaded ? 0 : tier === 'Pesada' ? 1 : tier === 'Media' ? 3 : null;
    const checkPenalty = tier === 'Pesada' ? -6 : tier === 'Media' ? -3 : 0;
    return { weight, weightParts, missingWeights, limits, tier, dexCap, checkPenalty, overloaded, strength, factor };
  }

  function equipment(character) {
    const equipped = (character.inventory ?? []).filter(item => item.equipped);
    const protection = equipped.filter(item => item.kind === 'armor' || item.kind === 'shield');
    const bonus = protection.map(item => ({
      ...part(item.name, (item.acBonus ?? 0) + (item.enhancement ?? 0)), source: item.id, type: item.kind,
    }));
    const checkPenalty = protection.reduce((total, item) => total + (item.checkPenalty ?? 0), 0);
    const untrained = protection.filter(item => item.proficient === false && item.checkPenalty)
      .map(item => part(item.name + ' (sin competencia)', item.checkPenalty));
    const armorCaps = protection.filter(item => item.dexCap != null).map(item => part(item.name, item.dexCap));
    const slows = protection.some(item => item.kind === 'armor' && item.slows);
    const failure = protection.reduce((total, item) => total + (item.arcaneFailure ?? 0), 0);
    return { bonus, checkPenalty, untrained, armorCaps, slows, failure };
  }

  function sheet(character) {
    const settings = character.combat ?? {};
    const effects = getEffects(character);
    const affecting = (...keys) => effects.filter(effect => keys.includes(effect.target));
    const scores = Object.fromEntries(Party.attributes.map(([key, name]) => [
      key, apply([part(name + ' base', character[key] ?? null)], affecting('ability:' + key)),
    ]));
    const ability = key => part(attributes[key], mod(scores[key].total));
    const size = sizes.find(([names]) => names.includes(normalize(character.size) || 'mediano'));
    const sizeNormal = part(character.size ? 'Tamaño' : 'Tamaño (Mediano)', size?.[1] ?? null);
    const sizeManeuver = part('Tamaño para maniobras', size ? -size[1] : null);
    const { bab, saves } = classProgression(character);
    const carried = load(character, scores.strength.total, size);
    const worn = equipment(character);
    const currentDex = ability('dexterity').value;
    const capParts = worn.armorCaps.slice();
    if (carried.dexCap != null) capParts.push(part('Carga ' + carried.tier.toLowerCase(), carried.dexCap));
    const cap = capParts.sort((a, b) => a.value - b.value)[0];
    const limited = cap && currentDex != null && currentDex > cap.value;
    const acDexterity = limited ? part('Destreza (límite de ' + cap.label + ')', cap.value) : ability('dexterity');
    const acBase = [part('Base', 10), sizeNormal];
    const armor = affecting('ac').concat(worn.bonus);
    const usableArmor = carried.overloaded ? armor.filter(item => item.value < 0 || item.type !== 'dodge') : armor;
    const defense = {
      ac: apply([...acBase, acDexterity], usableArmor),
      touch: apply([...acBase, acDexterity], usableArmor.filter(item => item.value < 0 || !touchExcluded.has(item.type)).concat(affecting('touch'))),
      flat: apply([...acBase, part('Destreza', currentDex == null ? null : Math.min(0, currentDex))],
        armor.filter(item => item.value < 0 || item.type !== 'dodge').concat(affecting('flat'))),
    };
    const baseAttack = part(settings.bab != null ? 'Ataque base manual' :
      settings.progression === 'manual' ? 'Ataque base por transcribir' : 'Ataque base de clase', bab);
    const maneuvers = {
      cmb: apply([baseAttack, ability(size?.[1] >= 2 ? 'dexterity' : 'strength'), sizeManeuver, ...worn.untrained], affecting('cmb', 'attack')),
      cmd: apply([part('Base', 10), baseAttack, ability('strength'), ability('dexterity'), sizeManeuver],
        affecting('ac').filter(item => item.value < 0 || cmdTypes.has(item.type)).concat(affecting('cmd'))),
    };
    const saving = Object.fromEntries(Object.keys(savingThrows).map(key => [
      key, apply([part(settings[key] != null ? 'Base manual' :
        settings.progression === 'manual' ? 'Base por transcribir' : 'Base de clase', saves[key]), ability(saveAbilities[key])], affecting(key, 'saves')),
    ]));
    const skills = (character.skills ?? []).map(entry => {
      const skillEffects = affecting('skills', skillTarget(entry.name));
      if (!entry.ability) return apply([part('Total manual', entry.modifier ?? null)], skillEffects);
      const usesPenalty = !entry.ignoreArmor && ['strength', 'dexterity'].includes(entry.ability);
      const penalty = usesPenalty ? Math.min(worn.checkPenalty, carried.checkPenalty) : 0;
      const base = [
        part('Rangos', entry.ranks ?? 0),
        ability(entry.ability),
        part('Habilidad de clase', entry.classSkill && entry.ranks > 0 ? 3 : 0),
        part('Ajuste manual', entry.modifier ?? 0),
      ];
      if (penalty) base.push(part(penalty === worn.checkPenalty ? 'Armadura y escudo' : 'Carga', penalty));
      return apply(base, skillEffects);
    });
    const speedText = String(character.speed ?? '').trim();
    const feet = /^(\d+)\s*(?:ft\.?|pies)?$/i.exec(speedText);
    const speed = settings.landSpeed ?? (feet ? Number(feet[1]) : null);
    const reduced = speed != null && !settings.ignoreSpeed && (worn.slows || ['Media', 'Pesada'].includes(carried.tier));
    const movement = carried.overloaded ? (carried.tier === 'Sobrecarga' ? 5 : 0) : reduced ? Math.ceil(speed * 2 / 15) * 5 : speed;
    const initiative = apply([ability('dexterity'), ...worn.untrained], affecting('initiative'));
    return { scores, ability, defense, initiative, bab, saving, maneuvers, skills, carried, worn,
      movement, speed, sizeNormal, baseAttack, affecting };
  }

  function weapon(sheetStats, item) {
    const { ability, sizeNormal, baseAttack, worn, affecting, bab } = sheetStats;
    const ranged = item.mode === 'ranged' || item.mode === 'thrown';
    const attackAbility = item.attackAbility || (ranged ? 'dexterity' : 'strength');
    const attackParts = [baseAttack, ability(attackAbility), sizeNormal, ...worn.untrained,
      part('Competencia con el arma', item.proficient === false ? -4 : 0),
      part('Ajuste manual', item.attackAdjustment ?? 0)];
    if (item.damageMode === 'limited') {
      const strength = ability('strength').value;
      attackParts.push(part('Fuerza requerida por el arco compuesto',
        strength == null ? null : strength < (item.damageCap ?? 0) ? -2 : 0));
    }
    const enhancement = item.enhancement ?? 0;
    const weaponEffect = (value, label) => ({ ...part(label, value), type: 'enhancement', source: item.id });
    const attack = apply(attackParts, affecting('attack', ranged ? 'ranged' : 'melee')
      .concat(weaponEffect(Math.max(enhancement, item.masterwork ? 1 : 0), enhancement ? 'Mejora del arma' : 'Arma de gran calidad')));
    const damageAbility = ability(item.damageAbility || 'strength');
    const raw = damageAbility.value;
    let damageModifier = 0;
    switch (item.damageMode) {
      case 'none': break;
      case 'twoHands': damageModifier = raw > 0 ? Math.floor(raw * 1.5) : raw; break;
      case 'offHand': damageModifier = raw > 0 ? Math.floor(raw / 2) : raw; break;
      case 'penalty': damageModifier = raw == null ? null : Math.min(0, raw); break;
      case 'limited': damageModifier = raw == null ? null : Math.min(raw, item.damageCap ?? 0); break;
      default: damageModifier = item.damageMode == null && item.mode === 'ranged' ? 0 : raw;
    }
    const damage = item.damageMode === 'sheet'
      ? apply([part('Ajuste manual', item.damageAdjustment ?? 0)], affecting('damage'))
      : apply([part(damageAbility.label, damageModifier), part('Ajuste manual', item.damageAdjustment ?? 0)],
        affecting('damage').concat(weaponEffect(enhancement, 'Mejora del arma')));
    const attacks = attack.total == null ? [] : Array.from(
      { length: item.singleAttack ? 1 : Math.min(4, Math.max(1, Math.ceil(bab / 5))) },
      (_, index) => expression('d20', attack.total - index * 5));
    const extra = apply([], affecting('extraAttack'));
    return { attack, attacks, extra, damage, damageExpression: expression(item.damageDice, damage.total) };
  }

  function spellDC(character, spell) {
    const effects = getEffects(character);
    const attribute = character.spellMode === 'manual' ? character.castingAbility : 'cha';
    const score = attribute ? apply([part(attributes[attribute], character[attribute] ?? null)],
      effects.filter(effect => effect.target === 'ability:' + attribute)) : null;
    const modifier = score ? mod(score.total) : character.castingModifier ?? null;
    const base = BardRules.spellDC(character, spell, modifier);
    if (!base) return null;
    return apply([
      part('Base', 10), part('Nivel del conjuro', spell.l),
      part(attributes[attribute] ?? 'Ajuste de lanzamiento', base.modifier),
      part('Spell Focus', base.focus),
    ], effects.filter(effect => effect.target === 'spellDc'));
  }

  function compareWithSheet(character, stats = sheet(character)) {
    const computed = {
      ...Object.fromEntries(Object.entries(stats.defense).map(([key, value]) => [key, value])),
      initiative: stats.initiative,
      ...stats.saving,
      ...stats.maneuvers,
    };
    const reference = character.combat?.referenceTotals ?? {};
    return Object.entries(referenceStats).map(([key, label]) => {
      const calculation = computed[key];
      const recorded = reference[key] ?? null;
      const total = calculation.total;
      return { key, label, recorded, total, calculation,
        difference: recorded == null || total == null ? null : total - recorded };
    });
  }

  function ruleLink(record) {
    if (/^https?:\/\/(?:www\.)?d20pfsrd\.com\//i.test(record.url ?? '')) return record.url;
    if (/^https?:\/\/(?:www\.)?aonprd\.com\//i.test(record.url ?? '')) return record.url;
    if (/^https?:\/\/(?:www\.)?d20pfsrd\.com\//i.test(record.apiSourceUrl ?? '')) return record.apiSourceUrl;
    if (/^https?:\/\/(?:www\.)?aonprd\.com\//i.test(record.apiSourceUrl ?? '')) return record.apiSourceUrl;
    return 'https://www.d20pfsrd.com/?s=' + encodeURIComponent(record.name);
  }

  return { categories, types, targets, modes, damageModes, coins, savingThrows, referenceStats, attributes, skillTarget,
    signed, expression, apply, sheet, weapon, spellDC, ruleLink, compareWithSheet };
})();
