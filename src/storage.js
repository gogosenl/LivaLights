import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_SCHEMA_VERSION, STARTING_FREE_HINTS } from './config';

const KEY = '@lantern-lines/save';

export const freshSave = () => ({
  schema: SAVE_SCHEMA_VERSION,
  introSeen: false,
  currentLevel: 0,
  lastPlayedLevel: null,
  lastSelectedLayer: null,
  completed: {},
  stars: {},
  unlockedLevels: 1,
  unlockedLayers: 1,
  hintCoins: 0,
  layerCoins: 0,
  freeHints: STARTING_FREE_HINTS,
  adsRemoved: false,
  uniqueCompletions: 0,
  settings: { language: 'tr', music: true, sound: true, vibration: true },
  migrations: {}
});

function migrate(input) {
  const base = freshSave();
  if (!input || typeof input !== 'object') return base;
  if (input.schema !== SAVE_SCHEMA_VERSION) {
    return {
      ...base,
      adsRemoved: Boolean(input.adsRemoved),
      settings: { ...base.settings, ...(input.settings || {}) },
      migrations: { ...(input.migrations || {}), fiveHundredLevels: true }
    };
  }
  const merged = { ...base, ...input, settings: { ...base.settings, ...(input.settings || {}) } };
  merged.schema = SAVE_SCHEMA_VERSION;
  return merged;
}

export async function loadSave() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return migrate(raw ? JSON.parse(raw) : null);
  } catch {
    return freshSave();
  }
}

export async function persistSave(save) {
  await AsyncStorage.setItem(KEY, JSON.stringify(save));
}

export async function clearSave() {
  await AsyncStorage.removeItem(KEY);
}
