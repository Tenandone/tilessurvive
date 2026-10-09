'use strict';
// Search only reviewed public fields. This module never loads extraction output.
const gear = require('../../data/foundation-40/hero-gear-levels-41.json');
const pets = require('../../data/foundation-40/pet-training-profiles-41.json');
const official = require('./official-locales-40');
const langs = ['ko', 'en', 'ja', 'ru', 'zh-tw'];
const copy = {
  ko: { gear: '전용 장비 레벨 비교', effect: 'Lv.1–15 주요 효과', pets: '펫 훈련 비용 · 전용 각인', stages: '7종 펫의 0→5단계 훈련 비용과 전용 각인. 단계 시작부터 합산하며 진행 중인 훈련은 차감하지 않습니다.' },
  en: { gear: 'Exclusive gear level comparison', effect: 'Primary effects at Lv.1–15', pets: 'Pet training costs and imprints', stages: 'Training costs and dedicated imprints for seven pets, stages 0→5. Counts from the start of each stage; partial progress is not deducted.' },
  ja: { gear: '専用装備レベル比較', effect: 'Lv.1–15の基本効果', pets: 'ペット訓練費用と専用素材', stages: '7種のペットの0→5段階の訓練費用と専用素材。各段階の開始から合算し、途中の進捗は差し引きません。' },
  ru: { gear: 'Сравнение уровней особого снаряжения', effect: 'Основные эффекты на ур. 1–15', pets: 'Стоимость тренировки питомцев и материалы', stages: 'Стоимость тренировки и личные материалы семи питомцев, этапы 0→5. Расчёт с начала этапа; частичный прогресс не вычитается.' },
  'zh-tw': { gear: '專屬裝備等級比較', effect: 'Lv.1–15主要效果', pets: '寵物訓練費用與專用材料', stages: '7種寵物0→5階段的訓練費用與專用材料。從每個階段起點加總，不扣除進行中的訓練進度。' }
};
function entries() {
  return langs.flatMap(language => {
    const t = copy[language], characters = official.entries(language);
    const heroEntries = gear.gears.map(profile => {
      const hero = characters.find(entry => entry.type === 'heroes' && entry.entity.id === profile.id);
      if (!hero?.entity.gear) throw Error(`Missing reviewed hero gear label: ${language}/${profile.id}`);
      const names = hero.entity.gear;
      return { language, type: 'heroe', title: `${hero.entity.names[language]} · ${t.gear}`, description: `${names.name[language]} · ${names.skillName[language]} · ${t.effect}`, url: `${hero.route}#hero-primary-gear-levels-41`, aliases: [...new Set(hero.names)].join(' ') };
    });
    return [...heroEntries, { language, type: 'database', title: t.pets, description: t.stages, url: `/${language}/database/pet-system/#pet-training-scope-41`, aliases: pets.pets.flatMap(pet => [pet.names[language], pet.resourceNames[language]]).join(' ') }];
  });
}
module.exports = { entries };
