const PathfinderApi = (() => {
  'use strict';

  const BASE = 'https://api-pathfinder1e.vercel.app/api';
  const cache = new Map();
  const classNames = {
    bardo: 'bard', barbaro: 'barbarian', clerigo: 'cleric', druida: 'druid', explorador: 'ranger',
    guardabosques: 'ranger', guerrero: 'fighter', hechicero: 'sorcerer', mago: 'wizard', monje: 'monk',
    paladin: 'paladin', picaro: 'rogue', alquimista: 'alchemist', investigador: 'investigator',
    oraculo: 'oracle', convocador: 'summoner', magus: 'magus', ocultista: 'occultist',
    espiritista: 'spiritualist', mesmerista: 'mesmerist', medium: 'medium', psiconico: 'psychic',
    cazador: 'hunter', arcanista: 'arcanist', bloodrager: 'bloodrager', shaman: 'shaman', brujo: 'witch',
  };
  const normalize = value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function classKey(character) {
    const first = String(character?.className ?? '').split(/[,+/]/)[0].replace(/\s+\d+.*$/, '').trim();
    return classNames[normalize(first)] ?? '';
  }

  async function request(path, params = {}) {
    const url = new URL(BASE + path);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
    const key = url.toString();
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;

    const response = await fetch(key, { headers: { Accept: 'application/json' } });
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) throw new Error(body?.error || `La API respondió ${response.status}.`);
    if (!body || !Array.isArray(body.data)) throw new Error('La API devolvió una respuesta inesperada.');
    cache.set(key, { value: body, expires: Date.now() + 60 * 60 * 1000 });
    return body;
  }

  async function searchSpells(query, character, page = 1) {
    const klass = classKey(character);
    return request('/spells', { q: query, class: klass, page, limit: 30 });
  }

  async function searchItems(query, page = 1) {
    return request('/items', { q: query, page, limit: 30 });
  }

  async function searchFeats(query, page = 1) {
    return request('/feats', { q: query, page, limit: 30 });
  }

  function stripMarkup(value) {
    return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function spellRecord(record, character) {
    const klass = classKey(character);
    const level = Number(record.classes?.[klass] ?? record.level ?? 0);
    const sourceUrl = record.source_url ?? '';
    const origin = record.data_origin ?? 'API PF1e';
    const schools = { abjuration: 'Abjuración', divination: 'Adivinación', conjuration: 'Conjuración',
      enchantment: 'Encantamiento', evocation: 'Evocación', illusion: 'Ilusión', necromancy: 'Nigromancia', transmutation: 'Transmutación' };
    return {
      id: `pfapi-${record.slug}-${level}`,
      l: level,
      name: record.name,
      es: record.name_es ?? '',
      school: schools[normalize(record.school)] ?? 'Sin especificar',
      cast: record.casting_time ?? '',
      range: record.range ?? '',
      duration: record.duration ?? '',
      save: record.saving_throw ?? 'Ninguna',
      dice: 'Guía de dados pendiente de revisar en la ficha de la fuente.',
      desc: stripMarkup(record.description || record.short_description),
      tip: '',
      source: sourceUrl || `https://api-pathfinder1e.vercel.app/api/spells/${encodeURIComponent(record.slug)}`,
      sourceSite: 'API Pathfinder 1e',
      apiSource: record.source ?? '',
      apiOrigin: origin,
      components: record.components ?? 'Consultar reglas',
      sr: record.spell_resistance ?? '',
    };
  }

  function itemRecord(record) {
    const type = String(record.type ?? '').toLowerCase();
    const subtype = String(record.subtype ?? '').toLowerCase();
    const stats = record.base_stats ?? {};
    const kind = type === 'weapon' ? 'weapon'
      : type === 'armor' && /shield|buckler/.test(subtype + ' ' + record.name.toLowerCase()) ? 'shield'
        : type === 'armor' ? 'armor' : 'equipment';
    const item = {
      id: Party.newId(), name: record.name, kind, quantity: 1, carried: true, equipped: false,
      weight: Number.isFinite(record.weight) ? record.weight : undefined,
      price: Number.isFinite(record.price_gp) ? record.price_gp : undefined,
      apiSource: record.source ?? '', apiOrigin: record.data_origin ?? '', apiSourceUrl: record.source_url ?? '',
      url: record.source_url ?? '',
    };

    if (kind === 'armor' || kind === 'shield') {
      if (Number.isFinite(stats.armor_bonus)) item.acBonus = stats.armor_bonus;
      if (Number.isFinite(stats.max_dex)) item.dexCap = stats.max_dex;
      if (Number.isFinite(stats.check_penalty)) item.checkPenalty = stats.check_penalty;
      if (Number.isFinite(stats.spell_failure_pct)) item.arcaneFailure = stats.spell_failure_pct;
      if (stats.speed && /20\s*ft/i.test(stats.speed)) item.slows = true;
    }
    if (kind === 'weapon') {
      const damage = String(stats.damage ?? '');
      const mediumDamage = damage.match(/(\d+d\d+)\s*\(medium\)/i);
      const anyDamage = damage.match(/\d+d\d+/i);
      if (mediumDamage) item.damageDice = mediumDamage[1];
      else if (anyDamage) item.damageDice = anyDamage[0];
      const critical = String(stats.critical ?? '').match(/(\d+)-20\s*\/\s*x(\d+)/i);
      if (critical) { item.critMin = Number(critical[1]); item.critMultiplier = Number(critical[2]); }
      else {
        const multiplier = String(stats.critical ?? '').match(/x(\d+)/i);
        if (multiplier) item.critMultiplier = Number(multiplier[1]);
      }
      const range = String(stats.range ?? '').match(/(\d+)/);
      if (range) item.range = Number(range[1]);
      const category = String(stats.category ?? '').toLowerCase();
      item.mode = category.includes('ranged') || category.includes('thrown') ? 'ranged' : 'melee';
      const damageType = String(stats.damage_type ?? '').trim().toUpperCase();
      item.damageType = ({ P: 'Perforante', S: 'Cortante', B: 'Contundente' })[damageType] ?? damageType;
    }

    const bonuses = Array.isArray(record.bonuses) ? record.bonuses : [];
    const bonusNote = bonuses.length
      ? 'Bonificadores sugeridos por API (revisar antes de cargarlos como efectos): ' +
        bonuses.map(bonus => `${bonus.formula ?? ''} ${bonus.type ?? ''} a ${bonus.target ?? 'objetivo sin normalizar'}`).join('; ') + '.'
      : 'La API no informó bonificadores estructurados.';
    item.notes = [
      record.description ? stripMarkup(record.description) : '',
      `Origen de datos: ${item.apiOrigin || 'no informado'}.`,
      bonusNote,
      stats.matched_name && stats.matched_name !== record.name ? `Estadísticas base asociadas: ${stats.matched_name}. Revisar materiales y variantes.` : '',
    ].filter(Boolean).join('\n');
    return item;
  }

  function featRecord(record) {
    const sourceUrl = record.source_url ?? '';
    return {
      name: record.name,
      url: sourceUrl,
      notes: [
        record.category?.length ? `Categorías: ${record.category.join(', ')}.` : '',
        record.prerequisites ? `Prerrequisitos: ${stripMarkup(record.prerequisites)}` : '',
        record.benefit ? `Beneficio: ${stripMarkup(record.benefit)}` : '',
        record.normal ? `Normal: ${stripMarkup(record.normal)}` : '',
        record.special ? `Especial: ${stripMarkup(record.special)}` : '',
        `Origen de datos: ${record.data_origin ?? 'no informado'}.`,
      ].filter(Boolean).join('\n'),
    };
  }

  return { classKey, searchSpells, searchItems, searchFeats, spellRecord, itemRecord, featRecord };
})();
