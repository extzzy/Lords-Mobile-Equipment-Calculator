document.addEventListener('DOMContentLoaded', () => {
  const slots = document.querySelectorAll('.slot');
  const slotWraps = document.querySelectorAll('.slot-wrap');
  const clearBtn = document.getElementById('clear-btn');
  const modal = document.getElementById('item-modal');
  const modalTitle = modal.querySelector('.modal-title');
  const modalItemsEl = document.getElementById('modal-items');
  const gradeChipsEl = document.getElementById('grade-chips');
  const confirmBtn = document.getElementById('confirm-btn');
  const temperSection = document.getElementById('sidebar-temper');
  const temperRange = document.getElementById('temper-tier');
  const temperDisplay = document.getElementById('temper-display');
  const setChipsEl = document.getElementById('set-chips');
  const setSelectMobileEl = document.getElementById('item-set-mobile');
  const langSwitch = document.getElementById('lang-switch');
  const saveBtn = document.getElementById('save-btn');
  const exportBtn = document.getElementById('export-btn');
  const exportModal = document.getElementById('export-modal');
  const exportOutput = document.getElementById('export-output');
  const exportCopyBtn = document.getElementById('export-copy-btn');
  const importBtn = document.getElementById('import-btn');
  const importModal = document.getElementById('import-modal');
  const importInput = document.getElementById('import-input');
  const importMessage = document.getElementById('import-message');
  const importApplyBtn = document.getElementById('import-apply-btn');
  const presetsBtn = document.getElementById('presets-btn');
  const presetsPopover = document.getElementById('presets-popover');
  const compareBar = document.getElementById('compare-bar');
  const compareNameEl = document.getElementById('compare-name');
  const stopCompareBtn = document.getElementById('stop-compare-btn');

  const PRESETS_KEY = 'lords-presets';
  let comparePresetId = null;
  let currentPresetId = null;        // id «активного» пресета (если загружен/сохранён)

  // ───── Подсказки (?) ─────
  const helpTooltip = document.getElementById('help-tooltip');
  let helpAnchor = null;

  function showHelp(iconEl) {
    const key = iconEl.dataset.helpKey;
    if (!key) return;
    helpTooltip.textContent = t(key);
    helpTooltip.hidden = false;
    // Позиционирование: под иконкой, со сдвигом стрелки на её центр
    const r = iconEl.getBoundingClientRect();
    const ttW = helpTooltip.offsetWidth;
    const margin = 8;
    const arrowOffset = 12;
    let left = r.left - arrowOffset;
    // не вылезаем за правый край
    const maxLeft = window.innerWidth - ttW - margin;
    if (left > maxLeft) left = maxLeft;
    if (left < margin) left = margin;
    const arrowX = r.left + r.width / 2 - left - 6;
    helpTooltip.style.left = left + 'px';
    helpTooltip.style.top = (r.bottom + margin) + 'px';
    helpTooltip.style.setProperty('--arrow-x', arrowX + 'px');
    iconEl.classList.add('active');
    helpAnchor = iconEl;
  }

  function hideHelp() {
    helpTooltip.hidden = true;
    if (helpAnchor) helpAnchor.classList.remove('active');
    helpAnchor = null;
  }

  document.addEventListener('click', e => {
    const icon = e.target.closest('.help-icon');
    if (icon) {
      e.stopPropagation();
      if (helpAnchor === icon) hideHelp();
      else { hideHelp(); showHelp(icon); }
      return;
    }
    if (helpAnchor && !helpTooltip.contains(e.target)) hideHelp();
  });

  window.addEventListener('resize', hideHelp);
  window.addEventListener('scroll', hideHelp, true);

  const JUNK_KEY = 'lords-hide-junk';
  const junkToggleBtn = document.getElementById('junk-toggle');
  const junkToggleLabel = junkToggleBtn.querySelector('span');
  let hideJunk = false;
  try { hideJunk = localStorage.getItem(JUNK_KEY) === '1'; } catch (_) {}

  // Статы, считающиеся «мусором» при включённом фильтре
  const JUNK_STATS = new Set([
    'infantryDefense','rangedDefense','cavalryDefense','siegeDefense',
    'armyDefense','trapDefense','wallDefense',
    'eff_infantryDefense','eff_rangedDefense','eff_cavalryDefense','eff_siegeDefense',
    'siegeAttack','siegeHp','eff_siegeAttack','eff_siegeHp',
    'gatheringSpeed','researchSpeed','constructionSpeed','trainingSpeed',
    'craftingSpeed','craftingCapacity','forgingSpeed',
    'goldProduction','foodProduction','timberProduction','stoneProduction','oreProduction',
    'upkeepReduction','playerExpBoost'
  ]);

  function updateJunkToggle() {
    junkToggleBtn.setAttribute('aria-pressed', hideJunk ? 'true' : 'false');
    junkToggleLabel.textContent = t('btn.hideJunk');
  }
  junkToggleBtn.addEventListener('click', () => {
    hideJunk = !hideJunk;
    try { localStorage.setItem(JUNK_KEY, hideJunk ? '1' : '0'); } catch (_) {}
    updateJunkToggle();
    renderTotal();
  });
  updateJunkToggle();

  // Модалка украшений
  const jewelModal = document.getElementById('jewel-modal');
  const jewelModalTitle = document.getElementById('jewel-modal-title');
  const jewelModalItemsEl = document.getElementById('jewel-modal-items');
  const jewelGradeChipsEl = document.getElementById('jewel-grade-chips');
  const jewelCategoryChipsEl = document.getElementById('jewel-category-chips');
  const jewelConfirmBtn = document.getElementById('jewel-confirm-btn');

  // Минимальный уровень предмета для применения астралита (по правилам игры)
  const TEMPER_MIN_LEVEL = 50;

  // Можно ли темперить предмет астралитом: уровень >= 50, грейд = Mythic (явно
  // или fixedGrade === Mythic), и нет fixedGrade ниже Mythic.
  function canTemperItem(item) {
    if (!item) return false;
    if (item.fixedGrade && item.fixedGrade !== RARITY.MYTHIC) return false;
    return (item.level || 0) >= TEMPER_MIN_LEVEL;
  }

  // Максимальный тир астралита для конкретного предмета (наследуется от сета).
  // Без override = глобальный TEMPER_MAX_TIER (15).
  function getItemMaxTier(item) {
    if (!item) return TEMPER_MAX_TIER;
    if (typeof item.maxTemperTier === 'number') return item.maxTemperTier;
    const setMeta = SET_LIST.find(s => s.id === item.set);
    if (setMeta && typeof setMeta.maxTemperTier === 'number') return setMeta.maxTemperTier;
    return TEMPER_MAX_TIER;
  }

  let currentSlot = null;
  let currentGrade = RARITY_ORDER[0];
  let currentTier = 0;
  let currentSetFilter = 'all';
  let currentSearch = '';
  let currentSort = '';              // ключ стата или 'name' для сортировки в модалке
  let pendingIndex = null;
  let editingCompareSlot = false;    // редактируем правую (compare) доску
  const itemSearchInput = document.getElementById('item-search');
  const itemSortSelect = document.getElementById('item-sort');

  // Состояние jewel-модалки
  let currentJewelSlot = null;     // .slot элемент главного слота
  let currentJewelIndex = -1;      // 0/1/2 — какой из 3-х jewel-слотов
  let pendingJewelId = null;
  let currentJewelGrade = JEWEL_GRADE_ORDER[0];
  let currentJewelCategory = 'all';

  function getMultiplier(grade, tier) {
    const base = RARITY_MULTIPLIERS[grade] || 1;
    if (grade === RARITY.MYTHIC && tier > 0) {
      return base * (1 + TEMPER_BONUS[tier] / 70);
    }
    return base;
  }

  // Итоговый множитель статов предмета с учётом fixedGrade и астралита.
  // Для fixedGrade значения в data.js — уже финальные базовые, поэтому без grade-множителя;
  // астралит (T1+) накладывается отдельно.
  function getItemMultiplier(item, grade, tier) {
    if (item && item.fixedGrade) {
      if (item.fixedGrade === RARITY.MYTHIC && tier > 0) {
        return 1 + TEMPER_BONUS[tier] / 70;
      }
      return 1;
    }
    return getMultiplier(grade, tier);
  }

  const STAT_GROUPS = [
    { titleKey: 'group.effective', helpKey: 'help.effective', stats: [
      'eff_infantryAttack', 'eff_rangedAttack', 'eff_cavalryAttack', 'eff_siegeAttack',
      'eff_infantryDefense', 'eff_rangedDefense', 'eff_cavalryDefense', 'eff_siegeDefense',
      'eff_infantryHp', 'eff_rangedHp', 'eff_cavalryHp', 'eff_siegeHp'
    ] },
    { titleKey: 'group.resources', stats: [
      'gatheringSpeed', 'researchSpeed', 'constructionSpeed', 'trainingSpeed',
      'forgingSpeed', 'craftingSpeed', 'craftingCapacity',
      'goldProduction', 'foodProduction', 'timberProduction', 'stoneProduction', 'oreProduction',
      'upkeepReduction', 'playerExpBoost'
    ] },
    { titleKey: 'group.troops', stats: [
      'infantryAttack', 'infantryDefense', 'infantryHp',
      'rangedAttack', 'rangedDefense', 'rangedHp',
      'cavalryAttack', 'cavalryDefense', 'cavalryHp',
      'siegeAttack', 'siegeDefense', 'siegeHp'
    ] },
    { titleKey: 'group.army', stats: ['armyAttack', 'armyDefense', 'armyHp', 'armyCapacity', 'trapAttack', 'trapDefense', 'wallDefense'] },
    { titleKey: 'group.misc', stats: [
      'monsterHunt', 'monsterHuntTravelSpeed', 'monsterHuntDmg',
      'travelSpeed', 'maxEnergy', 'energySaver',
      'mergingSpeed', 'mergingSpeedSkillstone',
      'familiarTrainingExp', 'familiarSkillExp',
      'wonderInfantryAttack', 'wonderRangedAttack', 'wonderCavalryAttack',
      'wonderInfantryDefense', 'wonderRangedDefense', 'wonderCavalryDefense',
      'wonderTravelSpeed'
    ] }
  ];

  // Пары: эффективный_ключ → (троп-стат, army-стат). Эффект = troop + army.
  const EFFECTIVE_MAP = {
    eff_infantryAttack:  ['infantryAttack',  'armyAttack'],
    eff_rangedAttack:    ['rangedAttack',    'armyAttack'],
    eff_cavalryAttack:   ['cavalryAttack',   'armyAttack'],
    eff_siegeAttack:     ['siegeAttack',     'armyAttack'],
    eff_infantryDefense: ['infantryDefense', 'armyDefense'],
    eff_rangedDefense:   ['rangedDefense',   'armyDefense'],
    eff_cavalryDefense:  ['cavalryDefense',  'armyDefense'],
    eff_siegeDefense:    ['siegeDefense',    'armyDefense'],
    eff_infantryHp:      ['infantryHp',      'armyHp'],
    eff_rangedHp:        ['rangedHp',        'armyHp'],
    eff_cavalryHp:       ['cavalryHp',       'armyHp'],
    eff_siegeHp:         ['siegeHp',         'armyHp']
  };

  // ───── Локализация ─────
  applyStaticTranslations();
  document.documentElement.lang = getLocale();

  function updateLangButtons() {
    langSwitch.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === getLocale());
    });
  }
  updateLangButtons();
  langSwitch.addEventListener('click', e => {
    const btn = e.target.closest('.lang-btn');
    if (btn) setLocale(btn.dataset.lang);
  });

  function syncSlotTitleBase() {
    slots.forEach(slot => {
      slot.setAttribute('data-title-base', slot.getAttribute('title') || '');
    });
  }
  syncSlotTitleBase();

  document.addEventListener('localechange', () => {
    syncSlotTitleBase();
    updateLangButtons();
    updateJunkToggle();
    buildSetChips();
    buildJewelCategoryChips();
    buildSortSelect();
    if (currentSlot) {
      const slotLabel = currentSlot.getAttribute('data-title-base') || currentSlot.dataset.slot;
      modalTitle.textContent = `${t('modal.titlePrefix')}: ${slotLabel}`;
      renderModalItems();
    }
    if (currentJewelSlot) renderJewelModalItems();
    slots.forEach(renderSlot);
    slotWraps.forEach(renderJewelSlots);
    renderTotal();
    updateMainBoardLabel();
    if (comparePresetId) {
      const p = loadPresets().find(x => x.id === comparePresetId);
      if (p) showCompareBoard(p);
    }
  });

  // ───── Чипы грейдов снаряжения ─────
  RARITY_ORDER.forEach(grade => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'grade-chip';
    chip.dataset.grade = grade;
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-label', grade);
    chip.title = grade;
    chip.addEventListener('click', () => setGrade(grade));
    gradeChipsEl.appendChild(chip);
  });

  // Чипы грейдов украшений (5 шт, без Mythic)
  JEWEL_GRADE_ORDER.forEach(grade => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'grade-chip';
    chip.dataset.grade = grade;
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-label', grade);
    chip.title = grade;
    chip.addEventListener('click', () => setJewelGrade(grade));
    jewelGradeChipsEl.appendChild(chip);
  });

  function pendingItemObject() {
    if (!currentSlot || pendingIndex === null || pendingIndex === '') return null;
    const slotKey = currentSlot.dataset.slot;
    return (ITEMS[slotKey] || [])[pendingIndex] || null;
  }

  function updateTemperSectionVisibility() {
    // Темпер доступен только если: грейд Mythic, и (предмет не выбран ИЛИ
    // выбранный предмет проходит canTemperItem). До выбора предмета — показываем,
    // чтобы пользователь видел слайдер; при клике на «низкоуровневый» предмет — скроем.
    const item = pendingItemObject();
    const allow = currentGrade === RARITY.MYTHIC && (!item || canTemperItem(item));
    temperSection.hidden = !allow;
    if (!allow) {
      setTier(0);
    } else {
      // Пересинхронизируем max слайдера под выбранный предмет (Emperor → T5 и т.п.)
      setTier(currentTier);
    }
  }

  function setGrade(grade) {
    currentGrade = grade;
    gradeChipsEl.querySelectorAll('.grade-chip').forEach(c => {
      const isActive = c.dataset.grade === grade;
      c.classList.toggle('active', isActive);
      c.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });
    modalItemsEl.dataset.grade = grade;
    updateTemperSectionVisibility();
    updateTemperState();
    if (currentSlot) renderModalItems();
  }

  function setTier(tier) {
    const item = pendingItemObject();
    const maxTier = getItemMaxTier(item);
    currentTier = Math.max(0, Math.min(maxTier, Number(tier) || 0));
    temperRange.max = maxTier;
    temperRange.value = currentTier;
    temperDisplay.textContent = `T${currentTier}`;
    temperRange.style.setProperty('--p', (currentTier / maxTier) * 100 + '%');
    // Подпись справа от ползунка — динамическая
    const scale = temperSection.querySelector('.temper-scale span:last-child');
    if (scale) scale.textContent = `T${maxTier}`;
    updateTemperState();
    if (currentSlot) renderModalItems();
  }

  // Подсветка астралита на карточках предметов в модалке
  function updateTemperState() {
    const isTempered = currentGrade === RARITY.MYTHIC && currentTier > 0;
    modalItemsEl.classList.toggle('tempered', isTempered);
    if (isTempered) {
      modalItemsEl.dataset.temperBand = currentTier >= 15 ? 'high' : 'mid';
    } else {
      delete modalItemsEl.dataset.temperBand;
    }
  }
  temperRange.addEventListener('input', e => setTier(e.target.value));

  // ───── Чипы наборов ─────
  function buildSetChips() {
    const filters = [
      { id: 'all',     name: t('sets.all'),  icon: null, iconStyle: null },
      ...SET_LIST.map(s => s.id === SETS.NONE ? { ...s, name: t('sets.none') } : s)
    ];
    setChipsEl.innerHTML = filters.map(s => {
      const active = s.id === currentSetFilter ? 'active' : '';
      // Для синтетических фильтров (all, no-set) — используем готовое имя; для реальных сетов — переводим.
      const label = (s.id === 'all' || s.id === SETS.NONE) ? s.name : setLabel(s.id, s.name);
      if (s.iconStyle === 'banner') {
        return `<button type="button" class="set-chip ${active}" data-set="${s.id}" title="${label}" style="background-image: url('${s.icon}')" aria-label="${label}"></button>`;
      }
      if (s.iconStyle === 'icon') {
        return `<button type="button" class="set-chip-text ${active}" data-set="${s.id}">
          <img class="set-chip-text-icon" src="${s.icon}" alt=""><span class="set-chip-text-name">${label}</span>
        </button>`;
      }
      return `<button type="button" class="set-chip-text center ${active}" data-set="${s.id}">${label}</button>`;
    }).join('');

    // Параллельно держим в актуальном состоянии мобильный <select>
    if (setSelectMobileEl) {
      setSelectMobileEl.innerHTML = filters.map(s => {
        const label = (s.id === 'all' || s.id === SETS.NONE) ? s.name : setLabel(s.id, s.name);
        return `<option value="${s.id}">${label}</option>`;
      }).join('');
      setSelectMobileEl.value = currentSetFilter;
    }
  }
  // Обновляем .active без пересоздания всего списка, чтобы не сбивать скролл
  function syncSetFilterUI() {
    setChipsEl.querySelectorAll('.set-chip, .set-chip-text').forEach(el => {
      el.classList.toggle('active', el.dataset.set === currentSetFilter);
    });
    if (setSelectMobileEl) setSelectMobileEl.value = currentSetFilter;
  }

  setChipsEl.addEventListener('click', e => {
    const chip = e.target.closest('.set-chip, .set-chip-text');
    if (!chip) return;
    currentSetFilter = chip.dataset.set;
    syncSetFilterUI();
    renderModalItems();
  });
  if (setSelectMobileEl) {
    setSelectMobileEl.addEventListener('change', e => {
      currentSetFilter = e.target.value;
      syncSetFilterUI();
      renderModalItems();
    });
  }
  buildSetChips();

  // Чипы категорий украшений
  function buildJewelCategoryChips() {
    const cats = [{ id: 'all', name: t('sets.all') }, ...JEWEL_CATEGORIES.map(c => ({ id: c.id, name: t('jewelCat.' + c.id) }))];
    jewelCategoryChipsEl.innerHTML = cats.map(c => {
      const active = c.id === currentJewelCategory ? 'active' : '';
      return `<button type="button" class="set-chip-text center ${active}" data-cat="${c.id}">${c.name}</button>`;
    }).join('');
  }
  jewelCategoryChipsEl.addEventListener('click', e => {
    const chip = e.target.closest('.set-chip-text');
    if (!chip) return;
    currentJewelCategory = chip.dataset.cat;
    buildJewelCategoryChips();
    renderJewelModalItems();
  });
  buildJewelCategoryChips();

  // ───── Слоты ─────
  slots.forEach(slot => slot.addEventListener('click', () => openModal(slot)));

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      slots.forEach(slot => {
        delete slot.dataset.itemIndex;
        delete slot.dataset.rarity;
        delete slot.dataset.temperTier;
        delete slot.dataset.jewels;
        renderSlot(slot);
      });
      slotWraps.forEach(renderJewelSlots);
      setCurrentPreset(null);
    });
  }

  // ───── Клик в модалке предметов ─────
  modal.addEventListener('click', e => {
    if (e.target.hasAttribute('data-close')) { closeModal(); return; }
    const card = e.target.closest('.item-card');
    if (card && currentSlot) {
      pendingIndex = card.dataset.index;
      highlightSelectedCard();
      updateConfirmBtn();
      updateTemperSectionVisibility();
    }
  });

  confirmBtn.addEventListener('click', () => {
    if (!currentSlot || pendingIndex === null) return;
    if (pendingIndex === '') {
      delete currentSlot.dataset.itemIndex;
      delete currentSlot.dataset.rarity;
      delete currentSlot.dataset.temperTier;
      delete currentSlot.dataset.jewels;
    } else {
      const slotKey = currentSlot.dataset.slot;
      const pickedItem = (ITEMS[slotKey] || [])[pendingIndex];
      currentSlot.dataset.itemIndex = pendingIndex;
      // Если у предмета фиксированный грейд — используем его, иначе выбранный.
      // Астралит может применяться к Mythic-предметам (включая fixedGrade='Mythic'),
      // если уровень >= 50 (canTemperItem). Тир клипается до maxTemperTier предмета/сета.
      if (pickedItem && pickedItem.fixedGrade) {
        currentSlot.dataset.rarity = pickedItem.fixedGrade;
      } else {
        currentSlot.dataset.rarity = currentGrade;
      }
      const effectiveGrade = currentSlot.dataset.rarity;
      if (effectiveGrade === RARITY.MYTHIC && currentTier > 0 && canTemperItem(pickedItem)) {
        const maxT = getItemMaxTier(pickedItem);
        currentSlot.dataset.temperTier = Math.min(currentTier, maxT);
      } else {
        delete currentSlot.dataset.temperTier;
      }
    }
    renderSlot(currentSlot);
    // обновляем jewel-слоты (могли стать активными/нет)
    const wrap = currentSlot.closest('.slot-wrap');
    if (wrap) renderJewelSlots(wrap);
    if (editingCompareSlot) {
      saveCompareBoardToPreset();
      renderTotal();
    }
    closeModal();
  });

  // ───── Клик в модалке украшений ─────
  jewelModal.addEventListener('click', e => {
    if (e.target.hasAttribute('data-close')) { closeJewelModal(); return; }
    const card = e.target.closest('.item-card');
    if (card && currentJewelSlot) {
      const jid = card.dataset.jewelId;
      // Проверка: нельзя выбрать уже установленный в другом слоте этого предмета
      if (card.classList.contains('disabled')) return;
      pendingJewelId = jid === '' ? '' : jid;
      highlightSelectedJewelCard();
      updateJewelConfirmBtn();
    }
  });

  jewelConfirmBtn.addEventListener('click', () => {
    if (!currentJewelSlot || pendingJewelId === null) return;
    const jewels = getSlotJewels(currentJewelSlot);
    if (pendingJewelId === '') {
      jewels[currentJewelIndex] = null;
    } else {
      jewels[currentJewelIndex] = { id: pendingJewelId, grade: currentJewelGrade };
    }
    setSlotJewels(currentJewelSlot, jewels);
    const wrap = currentJewelSlot.closest('.slot-wrap');
    if (wrap) renderJewelSlots(wrap);
    if (isCompareSlot(currentJewelSlot)) saveCompareBoardToPreset();
    renderTotal();
    closeJewelModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (helpAnchor) { hideHelp(); return; }
    if (!importModal.hidden) closeImport();
    else if (!exportModal.hidden) closeExport();
    else if (!jewelModal.hidden) closeJewelModal();
    else if (!modal.hidden) closeModal();
  });

  // ───── Открытие модалок ─────
  function openModal(slot) {
    currentSlot = slot;
    editingCompareSlot = isCompareSlot(slot);
    const slotLabel = slot.getAttribute('data-title-base') || slot.dataset.slot;
    const currentRarity = slot.dataset.rarity || RARITY_ORDER[0];
    const slotTier = Number(slot.dataset.temperTier) || 0;
    pendingIndex = slot.dataset.itemIndex !== undefined ? slot.dataset.itemIndex : null;
    currentSearch = '';
    if (itemSearchInput) itemSearchInput.value = '';

    modalTitle.textContent = `${t('modal.titlePrefix')}: ${slotLabel}`;
    setGrade(currentRarity);
    if (currentRarity === RARITY.MYTHIC) setTier(slotTier);
    renderModalItems();
    updateConfirmBtn();
    updateTemperSectionVisibility();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function isCompareSlot(el) {
    return !!(typeof compareBoardEl !== 'undefined' && compareBoardEl && compareBoardEl.contains(el));
  }

  if (itemSearchInput) {
    itemSearchInput.addEventListener('input', e => {
      currentSearch = e.target.value;
      renderModalItems();
    });
  }

  // Сборка <select> сортировки с optgroup'ами из STAT_GROUPS (исключая eff_*)
  function buildSortSelect() {
    if (!itemSortSelect) return;
    let html = `<option value="">${t('sort.none')}</option>`;
    html += `<option value="name">${t('sort.name')}</option>`;
    STAT_GROUPS.forEach(g => {
      const stats = g.stats.filter(s => !s.startsWith('eff_'));
      if (stats.length === 0) return;
      html += `<optgroup label="${t(g.titleKey)}">`;
      stats.forEach(s => {
        html += `<option value="${s}">${statLabel(s)}</option>`;
      });
      html += '</optgroup>';
    });
    itemSortSelect.innerHTML = html;
    itemSortSelect.value = currentSort;
  }
  buildSortSelect();

  if (itemSortSelect) {
    itemSortSelect.addEventListener('change', e => {
      currentSort = e.target.value;
      renderModalItems();
    });
  }

  function closeModal() {
    modal.hidden = true;
    currentSlot = null;
    document.body.style.overflow = '';
  }

  function openJewelModal(slotEl, jewelIndex) {
    currentJewelSlot = slotEl;
    currentJewelIndex = jewelIndex;
    const jewels = getSlotJewels(slotEl);
    const existing = jewels[jewelIndex];
    pendingJewelId = existing ? existing.id : null;
    setJewelGrade(existing ? existing.grade : JEWEL_GRADE_ORDER[0]);
    renderJewelModalItems();
    updateJewelConfirmBtn();
    jewelModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeJewelModal() {
    jewelModal.hidden = true;
    currentJewelSlot = null;
    currentJewelIndex = -1;
    document.body.style.overflow = '';
  }

  function setJewelGrade(grade) {
    currentJewelGrade = grade;
    jewelGradeChipsEl.querySelectorAll('.grade-chip').forEach(c => {
      const active = c.dataset.grade === grade;
      c.classList.toggle('active', active);
      c.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    if (currentJewelSlot) renderJewelModalItems();
  }

  // ───── Рендер модалки предметов ─────
  function renderModalItems() {
    if (!currentSlot) return;
    const slotKey = currentSlot.dataset.slot;
    const slotIcon = currentSlot.dataset.icon || '';
    const multiplier = getMultiplier(currentGrade, currentTier);
    const items = ITEMS[slotKey] || [];

    let html = `<div class="item-card empty" data-index="">
      <div class="item-card-icon">∅</div>
      <div class="item-card-body">
        <div class="item-card-name">${t('items.notSelected')}</div>
      </div>
    </div>`;

    const q = currentSearch.trim().toLowerCase();

    // Сортировка: оригинальные индексы сохраняются для data-index
    let ordered = items.map((item, index) => ({ item, index }));
    if (currentSort === 'name') {
      ordered.sort((a, b) => itemLabel(a.item.name).localeCompare(itemLabel(b.item.name)));
    } else if (currentSort) {
      ordered.sort((a, b) => {
        const av = a.item.stats[currentSort] || 0;
        const bv = b.item.stats[currentSort] || 0;
        return bv - av;
      });
    }

    ordered.forEach(({ item, index }) => {
      if (currentSetFilter !== 'all' && item.set !== currentSetFilter) return;
      if (q) {
        const ru = itemLabel(item.name).toLowerCase();
        const en = item.name.toLowerCase();
        if (!ru.includes(q) && !en.includes(q)) return;
      }
      // Итоговый множитель: fixedGrade-Legendary → 1; fixedGrade-Mythic+T → астралит-бонус; иначе grade × астралит.
      const mult = getItemMultiplier(item, currentGrade, canTemperItem(item) ? currentTier : 0);
      const statsText = Object.entries(item.stats).map(([s, v]) => {
        const final = Math.round(v * mult * 10) / 10;
        const unit = s === 'maxEnergy' ? '' : '%';
        return `${statLabel(s)}: +${final}${unit}`;
      }).join('<br>');
      const setMeta = SET_LIST.find(s => s.id === item.set);
      const iconSrc = item.icon || (setMeta && setMeta.icon) || slotIcon;
      const setBadge = setMeta && setMeta.id !== SETS.NONE
        ? `<span class="item-card-set">${setMeta.icon ? `<img class="item-card-set-icon" src="${setMeta.icon}" alt="">` : ''}${setLabel(setMeta.id, setMeta.name)}</span>`
        : '';
      // Астралит: только Mythic-предметы с уровнем 50+ и не fixedGrade-нон-Mythic
      const temperEligible = canTemperItem(item);
      const isTempered = temperEligible && currentGrade === RARITY.MYTHIC && currentTier > 0;
      const tierAttr = isTempered ? `data-temper-tier="${currentTier}"` : '';
      const fixedAttr = item.fixedGrade ? `data-fixed-grade="${item.fixedGrade}"` : '';
      const fixedBadge = item.fixedGrade
        ? `<span class="item-card-fixed">${item.fixedGrade}</span>`
        : '';
      const levelBadge = item.level
        ? `<span class="item-card-level">Lv ${item.level}</span>`
        : '';
      html += `<div class="item-card" data-index="${index}" ${fixedAttr} data-level="${item.level || 0}">
        <div class="item-card-icon" ${tierAttr}><img class="item-card-img" src="${iconSrc}" alt=""></div>
        <div class="item-card-body">
          <div class="item-card-name">${itemLabel(item.name)}</div>
          ${setBadge}${fixedBadge}${levelBadge}
          <div class="item-card-stats">${statsText}</div>
        </div>
      </div>`;
    });
    modalItemsEl.innerHTML = html;
    highlightSelectedCard();
  }

  function highlightSelectedCard() {
    modalItemsEl.querySelectorAll('.item-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.index === String(pendingIndex ?? ''));
    });
  }

  function updateConfirmBtn() {
    confirmBtn.disabled = (pendingIndex === null);
  }

  // ───── Рендер модалки украшений ─────
  function renderJewelModalItems() {
    if (!currentJewelSlot) return;
    const gradeIdx = JEWEL_GRADE_ORDER.indexOf(currentJewelGrade);
    const slotJewels = getSlotJewels(currentJewelSlot);
    const usedIdsElsewhere = slotJewels
      .map((j, i) => (j && i !== currentJewelIndex) ? j.id : null)
      .filter(Boolean);

    let html = `<div class="item-card empty" data-jewel-id="">
      <div class="item-card-icon">∅</div>
      <div class="item-card-body">
        <div class="item-card-name">${t('items.notSelected')}</div>
      </div>
    </div>`;

    JEWELS.forEach(j => {
      if (currentJewelCategory !== 'all' && j.category !== currentJewelCategory) return;
      const isUsed = usedIdsElsewhere.includes(j.id);
      const statsText = Object.entries(j.stats).map(([k, arr]) => {
        const val = arr[gradeIdx];
        const unit = k === 'maxEnergy' ? '' : '%';
        return `${statLabel(k)}: +${val}${unit}`;
      }).join('<br>');
      html += `<div class="item-card ${isUsed ? 'disabled' : ''}" data-jewel-id="${j.id}" ${isUsed ? `title="${t('jewels.alreadyUsed')}"` : ''}>
        <div class="item-card-icon"${j.icon ? '' : ''}><img class="item-card-img" src="${j.icon || ''}" alt=""></div>
        <div class="item-card-body">
          <div class="item-card-name">${j.name}</div>
          <div class="item-card-stats">${statsText}</div>
        </div>
      </div>`;
    });
    jewelModalItemsEl.innerHTML = html;
    highlightSelectedJewelCard();
  }

  function highlightSelectedJewelCard() {
    jewelModalItemsEl.querySelectorAll('.item-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.jewelId === String(pendingJewelId ?? ''));
    });
  }

  function updateJewelConfirmBtn() {
    jewelConfirmBtn.disabled = (pendingJewelId === null);
  }

  // ───── Slot jewels хранение ─────
  function getSlotJewels(slotEl) {
    try {
      const data = JSON.parse(slotEl.dataset.jewels || '[null,null,null]');
      while (data.length < 3) data.push(null);
      return data.slice(0, 3);
    } catch (_) {
      return [null, null, null];
    }
  }
  function setSlotJewels(slotEl, jewels) {
    const any = jewels.some(Boolean);
    if (any) slotEl.dataset.jewels = JSON.stringify(jewels);
    else delete slotEl.dataset.jewels;
  }

  // ───── Рендер слотов ─────
  function renderSlot(slot) {
    const slotKey = slot.dataset.slot;
    const itemIndex = slot.dataset.itemIndex;
    const addBtn = slot.querySelector('.slot-add');
    const slotImg = slot.querySelector('.slot-img');
    const defaultIcon = slot.dataset.icon;

    if (itemIndex === undefined) {
      slot.classList.remove('filled', 'tempered');
      delete slot.dataset.temperBand;
      if (addBtn) addBtn.textContent = '+';
      if (slotImg) slotImg.src = defaultIcon;
      slot.setAttribute('title', slot.getAttribute('data-title-base') || slotKey);
      renderTotal();
      return;
    }

    const item = ITEMS[slotKey][itemIndex];
    const rarity = slot.dataset.rarity || RARITY_ORDER[0];
    const tier = Number(slot.dataset.temperTier) || 0;
    const isTempered = rarity === RARITY.MYTHIC && tier > 0;

    slot.classList.add('filled');
    slot.classList.toggle('tempered', isTempered);
    if (isTempered) {
      // T1–14 синий, T15 фиолетовый
      slot.dataset.temperBand = tier >= 15 ? 'high' : 'mid';
    } else {
      delete slot.dataset.temperBand;
    }
    if (addBtn) addBtn.textContent = '✓';
    const setMeta = SET_LIST.find(s => s.id === item.set);
    if (slotImg) slotImg.src = item.icon || (setMeta && setMeta.icon) || defaultIcon;
    const itName = itemLabel(item.name);
    slot.setAttribute('title', isTempered ? `${itName} (${rarity} • T${tier})` : `${itName} (${rarity})`);
    renderTotal();
  }

  function renderJewelSlots(wrap) {
    const slotEl = wrap.querySelector('.slot');
    const container = wrap.querySelector('.jewel-slots');
    if (!container) return;
    const hasItem = slotEl.dataset.itemIndex !== undefined;
    const jewels = getSlotJewels(slotEl);
    // Слоты украшений показываются только когда предмет выбран
    container.hidden = !hasItem;
    container.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jewel-slot';
      btn.dataset.jewelIndex = i;
      btn.disabled = !hasItem;
      const j = jewels[i];
      if (j) {
        const meta = JEWELS.find(x => x.id === j.id);
        if (meta) {
          btn.dataset.grade = j.grade;
          btn.title = `${meta.name} (${j.grade})`;
          btn.innerHTML = `<img class="jewel-slot-img" src="${meta.icon || ''}" alt="">`;
        }
      } else {
        btn.textContent = '+';
      }
      btn.addEventListener('click', () => {
        if (!hasItem) return;
        openJewelModal(slotEl, i);
      });
      container.appendChild(btn);
    }
    // 4-й слот — заглушка, всегда disabled
    const placeholder = document.createElement('button');
    placeholder.type = 'button';
    placeholder.className = 'jewel-slot jewel-slot-placeholder';
    placeholder.disabled = true;
    placeholder.title = '—';
    container.appendChild(placeholder);
  }

  slotWraps.forEach(renderJewelSlots);

  // ───── Пресеты ─────
  function loadPresets() {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      if (!raw) return [];
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch (_) { return []; }
  }
  function savePresets(list) {
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); } catch (_) {}
  }

  function captureBoardState(boardEl) {
    const data = {};
    boardEl.querySelectorAll('.slot').forEach(slot => {
      const key = slot.dataset.slot;
      if (slot.dataset.itemIndex === undefined) {
        data[key] = null;
        return;
      }
      data[key] = {
        itemIndex: slot.dataset.itemIndex,
        rarity: slot.dataset.rarity || RARITY_ORDER[0],
        temperTier: Number(slot.dataset.temperTier) || 0,
        jewels: getSlotJewels(slot)
      };
    });
    return data;
  }

  function captureCurrentState() {
    return captureBoardState(mainBoardEl);
  }

  // Записать актуальное состояние compare-доски обратно в LS-пресет
  function saveCompareBoardToPreset() {
    if (!comparePresetId) return;
    const state = captureBoardState(compareBoardEl);
    const presets = loadPresets();
    const idx = presets.findIndex(p => p.id === comparePresetId);
    if (idx >= 0) {
      presets[idx].data = state;
      savePresets(presets);
    }
  }

  function applyState(state) {
    slots.forEach(slot => {
      const key = slot.dataset.slot;
      const s = state && state[key];
      if (!s) {
        delete slot.dataset.itemIndex;
        delete slot.dataset.rarity;
        delete slot.dataset.temperTier;
        delete slot.dataset.jewels;
      } else {
        slot.dataset.itemIndex = s.itemIndex;
        slot.dataset.rarity = s.rarity || RARITY_ORDER[0];
        if (s.temperTier && s.temperTier > 0) slot.dataset.temperTier = s.temperTier;
        else delete slot.dataset.temperTier;
        if (s.jewels && s.jewels.some(Boolean)) slot.dataset.jewels = JSON.stringify(s.jewels);
        else delete slot.dataset.jewels;
      }
      renderSlot(slot);
    });
    slotWraps.forEach(renderJewelSlots);
    renderTotal();
  }

  function genId() { return 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7); }

  saveBtn.addEventListener('click', () => {
    const defaultName = `${t('presets.defaultName')} ${loadPresets().length + 1}`;
    const name = prompt(t('presets.namePrompt'), defaultName);
    if (!name) return;
    const presets = loadPresets();
    const newId = genId();
    presets.push({ id: newId, name: name.trim() || defaultName, data: captureCurrentState() });
    savePresets(presets);
    setCurrentPreset(newId);
    renderPresetsPopover();
  });

  function setCurrentPreset(id) {
    currentPresetId = id;
    updateMainBoardLabel();
  }

  function updateMainBoardLabel() {
    const label = document.getElementById('main-board-label');
    if (!label) return;
    const p = currentPresetId ? loadPresets().find(x => x.id === currentPresetId) : null;
    label.textContent = p ? p.name : t('totals.current');
  }

  function togglePresetsPopover(force) {
    const open = force !== undefined ? force : presetsPopover.hidden;
    presetsPopover.hidden = !open;
    presetsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      renderPresetsPopover();
      positionPresetsPopover();
    }
  }

  function positionPresetsPopover() {
    const margin = 12;
    const btnRect = presetsBtn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - btnRect.bottom - margin;
    const spaceAbove = btnRect.top - margin;

    // На мобиле поповер фиксирован по вьюпорту через CSS — JS только сбрасывает inline-стили
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    if (isMobile) {
      presetsPopover.classList.remove('above');
      presetsPopover.classList.add('below');
      presetsPopover.style.top = '';
      presetsPopover.style.bottom = '';
      presetsPopover.style.maxHeight = '';
      return;
    }

    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    presetsPopover.classList.toggle('above', openUp);
    presetsPopover.classList.toggle('below', !openUp);
    presetsPopover.style.maxHeight = Math.max(160, (openUp ? spaceAbove : spaceBelow) - 12) + 'px';
    presetsPopover.style.top = '';
    presetsPopover.style.bottom = '';
  }

  window.addEventListener('resize', () => { if (!presetsPopover.hidden) positionPresetsPopover(); });
  window.addEventListener('scroll', () => { if (!presetsPopover.hidden) positionPresetsPopover(); }, true);

  presetsBtn.addEventListener('click', () => togglePresetsPopover());

  document.addEventListener('click', e => {
    if (presetsPopover.hidden) return;
    if (presetsPopover.contains(e.target) || presetsBtn.contains(e.target)) return;
    togglePresetsPopover(false);
  });

  function renderPresetsPopover() {
    const presets = loadPresets();
    if (presets.length === 0) {
      presetsPopover.innerHTML = `<div class="presets-empty">${t('presets.empty')}</div>`;
      return;
    }
    presetsPopover.innerHTML = presets.map(p => {
      const active = p.id === comparePresetId ? 'active' : '';
      const compareLabel = p.id === comparePresetId ? t('presets.stopCompare') : t('presets.compare');
      return `<div class="preset-row ${active}" data-id="${p.id}">
        <span class="preset-name">${escapeHtml(p.name)}</span>
        <button type="button" class="preset-btn" data-action="load">${t('presets.load')}</button>
        <button type="button" class="preset-btn" data-action="compare">${compareLabel}</button>
        <button type="button" class="preset-btn danger" data-action="delete" title="${t('presets.delete')}">&times;</button>
      </div>`;
    }).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  presetsPopover.addEventListener('click', e => {
    const btn = e.target.closest('.preset-btn');
    if (!btn) return;
    const row = btn.closest('.preset-row');
    if (!row) return;
    const id = row.dataset.id;
    const action = btn.dataset.action;
    const presets = loadPresets();
    const preset = presets.find(p => p.id === id);
    if (!preset) return;

    if (action === 'load') {
      applyState(preset.data);
      setCurrentPreset(id);
      togglePresetsPopover(false);
    } else if (action === 'compare') {
      if (comparePresetId === id) {
        comparePresetId = null;
      } else {
        comparePresetId = id;
      }
      updateCompareBar();
      renderTotal();
      renderPresetsPopover();
    } else if (action === 'delete') {
      if (!confirm(t('confirm.delete').replace('{name}', preset.name))) return;
      const idx = presets.findIndex(p => p.id === id);
      if (idx >= 0) {
        presets.splice(idx, 1);
        savePresets(presets);
        if (comparePresetId === id) {
          comparePresetId = null;
          updateCompareBar();
          renderTotal();
        }
        if (currentPresetId === id) setCurrentPreset(null);
        renderPresetsPopover();
      }
    }
  });

  stopCompareBtn.addEventListener('click', () => {
    comparePresetId = null;
    updateCompareBar();
    renderTotal();
  });

  // ───── Экспорт сета ─────
  function buildExport() {
    const state = captureCurrentState();
    const equipment = {};
    let hasAny = false;

    Object.entries(state).forEach(([slotKey, s]) => {
      if (!s) { equipment[slotKey] = null; return; }
      const item = (ITEMS[slotKey] || [])[s.itemIndex];
      if (!item) { equipment[slotKey] = null; return; }
      hasAny = true;
      const rarity = item.fixedGrade || s.rarity || RARITY_ORDER[0];
      const tier = s.temperTier || 0;
      const multiplier = getItemMultiplier(item, rarity, tier);
      const setMeta = SET_LIST.find(x => x.id === item.set);

      const itemStats = {};
      Object.entries(item.stats).forEach(([k, v]) => {
        itemStats[statLabel(k)] = +(v * multiplier).toFixed(2);
      });

      const jewels = (s.jewels || []).filter(Boolean).map(j => {
        const meta = JEWELS.find(x => x.id === j.id);
        if (!meta) return null;
        const gi = JEWEL_GRADE_ORDER.indexOf(j.grade);
        if (gi < 0) return null;
        const bonus = Object.entries(meta.stats).map(([k, arr]) => {
          const val = arr[gi];
          return `${statLabel(k)} +${val}${k === 'maxEnergy' ? '' : '%'}`;
        }).join(', ');
        return { name: meta.name, grade: j.grade, bonus };
      }).filter(Boolean);

      equipment[slotKey] = {
        item: item.name,
        set: setMeta ? setMeta.name : null,
        grade: rarity,
        tempering: rarity === RARITY.MYTHIC && tier > 0 ? `T${tier}` : null,
        stats: itemStats,
        jewels: jewels.length ? jewels : null
      };
    });

    const totals = computeTotalsFromState(state);
    const totalsByLabel = {};
    const effectiveByLabel = {};
    Object.entries(totals).forEach(([k, v]) => {
      const val = +v.toFixed(2);
      const target = k.startsWith('eff_') ? effectiveByLabel : totalsByLabel;
      target[statLabel(k)] = val;
    });

    return {
      hasAny,
      data: {
        timestamp: new Date().toISOString(),
        equipment,
        totals: totalsByLabel,
        effective: effectiveByLabel
      }
    };
  }

  function openExport() {
    const { hasAny, data } = buildExport();
    exportOutput.textContent = hasAny
      ? JSON.stringify(data, null, 2)
      : t('export.empty');
    exportModal.hidden = false;
    document.body.style.overflow = 'hidden';
    exportCopyBtn.disabled = !hasAny;
    exportCopyBtn.querySelector ? null : null;
    exportCopyBtn.textContent = t('btn.copy');
  }
  function closeExport() {
    exportModal.hidden = true;
    document.body.style.overflow = '';
  }

  exportBtn.addEventListener('click', openExport);

  exportModal.addEventListener('click', e => {
    if (e.target.hasAttribute('data-close')) closeExport();
  });

  // ───── Импорт сета ─────
  function openImport() {
    importInput.value = '';
    importMessage.hidden = true;
    importMessage.className = 'import-message';
    importMessage.textContent = '';
    importModal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => importInput.focus(), 50);
  }
  function closeImport() {
    importModal.hidden = true;
    document.body.style.overflow = '';
  }

  importBtn.addEventListener('click', openImport);
  importModal.addEventListener('click', e => {
    if (e.target.hasAttribute('data-close')) closeImport();
  });

  function showImportMsg(cls, text) {
    importMessage.className = 'import-message ' + cls;
    importMessage.textContent = text;
    importMessage.hidden = false;
  }

  function importFromJson(jsonStr) {
    let parsed;
    try { parsed = JSON.parse(jsonStr); }
    catch (e) { showImportMsg('error', t('import.errInvalid') + ': ' + e.message); return; }

    if (!parsed || typeof parsed.equipment !== 'object') {
      showImportMsg('error', t('import.errNoEquipment'));
      return;
    }

    const state = {};
    let unknown = 0;

    Object.entries(parsed.equipment).forEach(([slotKey, slotData]) => {
      if (!ITEMS[slotKey]) return;
      if (!slotData) { state[slotKey] = null; return; }

      // Найти предмет по имени (а если задан set — учесть и сет)
      const items = ITEMS[slotKey];
      let itemIdx = items.findIndex(it =>
        it.name === slotData.item &&
        (!slotData.set || sets_by_name(it.set) === slotData.set || it.set === slugifySetName(slotData.set))
      );
      if (itemIdx < 0) {
        // фолбэк — поиск только по имени
        itemIdx = items.findIndex(it => it.name === slotData.item);
      }
      if (itemIdx < 0) { unknown++; state[slotKey] = null; return; }

      let rarity = slotData.grade || RARITY_ORDER[0];
      if (!RARITY_ORDER.includes(rarity)) rarity = RARITY_ORDER[0];

      let temperTier = 0;
      if (slotData.tempering) {
        const m = String(slotData.tempering).match(/(\d+)/);
        if (m) temperTier = Math.min(TEMPER_MAX_TIER, Math.max(0, parseInt(m[1], 10)));
      }

      const jewels = [null, null, null];
      if (Array.isArray(slotData.jewels)) {
        slotData.jewels.slice(0, 3).forEach((j, i) => {
          if (!j) return;
          const meta = JEWELS.find(x => x.name === j.name || x.id === j.id);
          if (!meta) return;
          const grade = JEWEL_GRADE_ORDER.includes(j.grade) ? j.grade : JEWEL_GRADE_ORDER[0];
          jewels[i] = { id: meta.id, grade };
        });
      }

      state[slotKey] = {
        itemIndex: String(itemIdx),
        rarity,
        temperTier,
        jewels
      };
    });

    applyState(state);
    if (unknown > 0) {
      showImportMsg('warn', t('import.warnUnknown').replace('{n}', unknown));
    } else {
      showImportMsg('success', t('import.success'));
    }
    setTimeout(() => { if (!importModal.hidden) closeImport(); }, 1200);
  }

  function sets_by_name(setId) {
    const meta = SET_LIST.find(s => s.id === setId);
    return meta ? meta.name : setId;
  }
  function slugifySetName(name) {
    const meta = SET_LIST.find(s => s.name === name);
    return meta ? meta.id : name;
  }

  importApplyBtn.addEventListener('click', () => importFromJson(importInput.value.trim()));

  exportCopyBtn.addEventListener('click', () => {
    const text = exportOutput.textContent;
    if (!text) return;
    const restore = () => {
      setTimeout(() => { exportCopyBtn.textContent = t('btn.copy'); }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        exportCopyBtn.textContent = t('btn.copied');
        restore();
      });
    } else {
      // фолбэк — выделяем текст
      const range = document.createRange();
      range.selectNode(exportOutput);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      try { document.execCommand('copy'); exportCopyBtn.textContent = t('btn.copied'); restore(); } catch (_) {}
    }
  });

  function updateCompareBar() {
    if (!comparePresetId) {
      compareBar.hidden = true;
      hideCompareBoard();
      return;
    }
    const p = loadPresets().find(x => x.id === comparePresetId);
    if (!p) {
      comparePresetId = null;
      compareBar.hidden = true;
      hideCompareBoard();
      return;
    }
    compareBar.hidden = false;
    compareNameEl.textContent = p.name;
    showCompareBoard(p);
  }

  // ───── Доска сравнения ─────
  const compareCard = document.getElementById('compare-card');
  const compareBoardEl = document.getElementById('compare-board');
  const compareBoardName = document.getElementById('compare-board-name');
  const mainBoardEl = document.getElementById('main-board');

  function initCompareBoard() {
    // Клонируем структуру основной доски (без обработчиков)
    compareBoardEl.innerHTML = mainBoardEl.innerHTML;
    // Уберём titles чтобы не появлялись tooltips «Main-hand» и т.п.
    compareBoardEl.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.removeAttribute('data-i18n-title');
      el.removeAttribute('title');
    });
    // Биндим клик на каждый слот compare-доски — открывают модалку в режиме редактирования сравниваемого пресета
    compareBoardEl.querySelectorAll('.slot').forEach(slot => {
      slot.addEventListener('click', () => openModal(slot));
    });
  }
  initCompareBoard();

  function hideCompareBoard() {
    compareCard.hidden = true;
  }

  function showCompareBoard(preset) {
    compareCard.hidden = false;
    compareBoardName.textContent = preset.name;
    const slots = compareBoardEl.querySelectorAll('.slot');
    slots.forEach(slot => {
      const slotKey = slot.dataset.slot;
      const s = preset.data && preset.data[slotKey];
      if (!s) {
        delete slot.dataset.itemIndex;
        delete slot.dataset.rarity;
        delete slot.dataset.temperTier;
        delete slot.dataset.jewels;
      } else {
        slot.dataset.itemIndex = s.itemIndex;
        slot.dataset.rarity = s.rarity || RARITY_ORDER[0];
        if (s.temperTier && s.temperTier > 0) slot.dataset.temperTier = s.temperTier;
        else delete slot.dataset.temperTier;
        if (s.jewels && s.jewels.some(Boolean)) slot.dataset.jewels = JSON.stringify(s.jewels);
        else delete slot.dataset.jewels;
      }
      renderSlot(slot);
    });
    compareBoardEl.querySelectorAll('.slot-wrap').forEach(renderJewelSlots);
  }

  updateCompareBar();
  updateMainBoardLabel();

  // ───── Итоги ─────
  function computeTotalsFromState(state) {
    const totals = {};
    if (!state) return totals;
    Object.entries(state).forEach(([slotKey, s]) => {
      if (!s) return;
      const item = (ITEMS[slotKey] || [])[s.itemIndex];
      if (!item) return;
      // fixedGrade-Legendary → 1; fixedGrade-Mythic+T → астралит-бонус; иначе grade × астралит
      const multiplier = getItemMultiplier(item, s.rarity || RARITY_ORDER[0], s.temperTier || 0);
      for (const [stat, value] of Object.entries(item.stats)) {
        totals[stat] = (totals[stat] || 0) + value * multiplier;
      }
      (s.jewels || []).forEach(j => {
        if (!j) return;
        const meta = JEWELS.find(x => x.id === j.id);
        if (!meta) return;
        const gi = JEWEL_GRADE_ORDER.indexOf(j.grade);
        if (gi < 0) return;
        Object.entries(meta.stats).forEach(([k, arr]) => {
          totals[k] = (totals[k] || 0) + arr[gi];
        });
      });
    });
    // Производные показатели: войско + соответствующий армейский бонус
    for (const [effKey, [troopKey, armyKey]] of Object.entries(EFFECTIVE_MAP)) {
      const sum = (totals[troopKey] || 0) + (totals[armyKey] || 0);
      if (sum > 0) totals[effKey] = sum;
    }
    return totals;
  }

  function unitFor(stat) {
    return stat === 'maxEnergy' ? '' : '%';
  }

  function fmtVal(v, stat) {
    const r = Math.round(v * 10) / 10;
    return `+${r}${unitFor(stat)}`;
  }

  function fmtDelta(d, stat) {
    if (Math.abs(d) < 0.05) return { text: '0', cls: 'zero' };
    const r = Math.round(d * 10) / 10;
    const sign = r > 0 ? '+' : '−';
    return { text: `${sign}${Math.abs(r)}${unitFor(stat)}`, cls: r > 0 ? 'pos' : 'neg' };
  }

  function renderRow(stat, current, compared, isCompare) {
    if (!isCompare) {
      return `<div class="stat-row"><span class="stat-name">${statLabel(stat)}</span><span class="stat-value">${fmtVal(current, stat)}</span></div>`;
    }
    const c = current || 0;
    const o = compared || 0;
    const d = fmtDelta(o - c, stat);
    return `<div class="stat-row compare">
      <span class="stat-name">${statLabel(stat)}</span>
      <span class="stat-value">${fmtVal(c, stat)}</span>
      <span class="stat-value compared">${fmtVal(o, stat)}</span>
      <span class="stat-delta ${d.cls}">${d.text}</span>
    </div>`;
  }

  function renderTotal() {
    const current = computeTotalsFromState(captureCurrentState());
    const comparePreset = comparePresetId ? loadPresets().find(p => p.id === comparePresetId) : null;
    const compared = comparePreset ? computeTotalsFromState(comparePreset.data) : null;
    const isCompare = !!compared;

    const totalDiv = document.getElementById('total-stats');
    let allStats = new Set([...Object.keys(current), ...(compared ? Object.keys(compared) : [])]);
    if (hideJunk) {
      allStats = new Set([...allStats].filter(s => !JUNK_STATS.has(s)));
    }

    if (allStats.size === 0) {
      totalDiv.innerHTML = `<div class="empty">${t('totals.empty')}</div>`;
      return;
    }

    let html = '';
    const currentName = currentPresetId
      ? (loadPresets().find(p => p.id === currentPresetId) || {}).name
      : null;
    const leftLabel = currentName || t('totals.current');
    const rightLabel = isCompare ? comparePreset.name : '';
    const headerHtml = isCompare
      ? `<div class="stat-row compare stat-header">
          <span></span>
          <span class="hdr">${escapeHtml(leftLabel)}</span>
          <span class="hdr compared">${escapeHtml(rightLabel)}</span>
          <span class="hdr delta">${t('totals.delta')}</span>
        </div>`
      : '';

    const usedStats = new Set();
    STAT_GROUPS.forEach(group => {
      const rows = group.stats
        .filter(s => allStats.has(s))
        .map(s => {
          usedStats.add(s);
          return renderRow(s, current[s] || 0, compared ? (compared[s] || 0) : 0, isCompare);
        });
      if (rows.length === 0) return;
      const help = group.helpKey
        ? `<button type="button" class="help-icon" data-help-key="${group.helpKey}" aria-label="?">?</button>`
        : '';
      html += `<div class="stats-group"><div class="group-title"><span>${t(group.titleKey)}</span>${help}</div>${headerHtml}${rows.join('')}</div>`;
    });
    const leftover = [...allStats].filter(s => !usedStats.has(s));
    if (leftover.length > 0) {
      const rows = leftover.map(s => renderRow(s, current[s] || 0, compared ? (compared[s] || 0) : 0, isCompare));
      html += `<div class="stats-group"><div class="group-title">${t('group.other')}</div>${headerHtml}${rows.join('')}</div>`;
    }

    totalDiv.innerHTML = html;
  }

  renderTotal();
});
