export const SAVE_SCHEMA_VERSION = 2;

export const LAYERS = [
  { id: 'starter', tr: 'Başlangıç Bahçesi', en: 'Starter Garden', from: 0, count: 100, cost: 0, color: '#F6D26C' },
  { id: 'moon', tr: 'Ayışığı Korusu', en: 'Moonlit Grove', from: 100, count: 100, cost: 15, color: '#70C9B0' },
  { id: 'stars', tr: 'Yıldız Bahçesi', en: 'Star Garden', from: 200, count: 100, cost: 20, color: '#A99CF2' },
  { id: 'mist', tr: 'Sisli Gölet', en: 'Misty Pond', from: 300, count: 100, cost: 25, color: '#7DB7D8' },
  { id: 'bamboo', tr: 'Bambu Geçidi', en: 'Bamboo Passage', from: 400, count: 100, cost: 30, color: '#82C78B' },
  { id: 'sakura', tr: 'Sakura Avlusu', en: 'Sakura Court', from: 500, count: 100, cost: 35, color: '#E6A5B8' },
  { id: 'crystal', tr: 'Kristal Tapınak', en: 'Crystal Shrine', from: 600, count: 100, cost: 40, color: '#8FCBDD' },
  { id: 'sky', tr: 'Göksel Teras', en: 'Celestial Terrace', from: 700, count: 100, cost: 42, color: '#9DAFE8' },
  { id: 'eternal', tr: 'Ebedi Gece', en: 'Eternal Night', from: 800, count: 100, cost: 45, color: '#8178B8' },
  { id: 'palace', tr: 'Fener Sarayı', en: 'Lantern Palace', from: 900, count: 100, cost: 48, color: '#E0B36B' }
];

export const TOTAL_LEVELS = LAYERS.reduce((sum, layer) => sum + layer.count, 0);
export const STARTING_FREE_HINTS = 0;
export const HINT_COST = 3;
export const REMOTE_CONFIG_URL = '';

export const PRODUCTS = {
  ios: {
    hints10: 'com.gorsengames.lanternlines.hints10',
    hints30: 'com.gorsengames.lanternlines.hints30',
    hints75: 'com.gorsengames.lanternlines.hints75',
    layer20: 'com.gorsengames.lanternlines.layer20',
    layer60: 'com.gorsengames.lanternlines.layer60',
    layer150: 'com.gorsengames.lanternlines.layer150',
    removeAds: 'com.gorsengames.lanternlines.removeads'
  },
  android: {
    hints10: 'lantern_hints_10',
    hints30: 'lantern_hints_30',
    hints75: 'lantern_hints_75',
    layer20: 'lantern_layer_20',
    layer60: 'lantern_layer_60',
    layer150: 'lantern_layer_150',
    removeAds: 'lantern_remove_ads'
  }
};

// İlk 10 bölüm tamamen reklamsızdır. Sonrasında tamamlanan her 3. bölümde
// (13, 16, 19...) bir geçiş reklamı gösterilir.
export const AD_RULES = { adFreeLevels: 10, interval: 3 };

export function shouldShowInterstitial(_levelIndex, uniqueCompletions, replay, adsRemoved) {
  if (replay || adsRemoved) return false;
  return uniqueCompletions > AD_RULES.adFreeLevels
    && (uniqueCompletions - AD_RULES.adFreeLevels) % AD_RULES.interval === 0;
}

export function layerIndexFor(level) {
  return LAYERS.findIndex((layer) => level >= layer.from && level < layer.from + layer.count);
}

export function economyIsSolvable() {
  return LAYERS.slice(1).every((layer, index) => layer.cost <= LAYERS[index].count);
}
