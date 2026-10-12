import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, FlatList, Image, ImageBackground, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Asset } from 'expo-asset';
import * as Haptics from 'expo-haptics';
import { HINT_COST, LAYERS, PRODUCTS, REMOTE_CONFIG_URL, TOTAL_LEVELS, economyIsSolvable, layerIndexFor } from './src/config';
import { createLevel, isSolved, lineCounts, litCells, starsFor } from './src/game';
import { loadSave, persistSave } from './src/storage';
import { nativeServices, shouldShowInterstitial } from './src/services';
import { useGameAudio } from './src/audio';

const COLORS = { bg: '#081522', bg2: '#17293A', card: '#21364A', ink: '#F8F5ED', muted: '#C1CDD6', lamp: '#EACB91', green: '#74C9AA', red: '#D46B78', rock: '#101923', tile: '#33495D' };
const FONTS = {
  display: Platform.select({ ios: 'AvenirNext-Heavy', android: 'sans-serif-condensed', default: 'sans-serif' }),
  strong: Platform.select({ ios: 'AvenirNext-DemiBold', android: 'sans-serif-medium', default: 'sans-serif' }),
  body: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'sans-serif' })
};
const ASSETS = {
  icon: require('./assets/design-b/hero-lantern.png'),
  brandLogo: require('./assets/design-b/gorsen-games-logo.png'),
  backgrounds: [require('./assets/design-b/background.png'), require('./assets/design-b/background.png'), require('./assets/design-b/background.png')],
  levelScenes: [require('./assets/design-b/level-1.png'), require('./assets/design-b/level-2.png'), require('./assets/design-b/level-3.png')],
  tiles: { empty: require('./assets/design-b/tile-empty-v2.png'), lit: require('./assets/design-b/tile-lit-v2.png'), solved: require('./assets/design-b/solved-seal-v2.png') },
  heroLantern: require('./assets/design-b/hero-lantern.png'), lantern: require('./assets/design-b/tile-lantern.png'), rock: require('./assets/design-b/rock.png'), hint: require('./assets/design-b/hint.png'), crystal: require('./assets/design-b/crystal.png'),
  rewards: { earned: require('./assets/design-b/star-earned.png'), empty: require('./assets/design-b/star-empty.png'), crest: require('./assets/design-b/completion.png') },
  buttons: {
    home: require('./assets/design-b/home.png'), settings: require('./assets/design-b/settings.png'), levels: require('./assets/design-b/levels.png'), store: require('./assets/design-b/store.png'),
    back: require('./assets/design-b/back.png'), restart: require('./assets/design-b/restart.png'), move: require('./assets/design-b/move-counter.png'), play: require('./assets/design-b/play.png'), restore: require('./assets/design-b/restart.png')
  }
};
const STARTUP_ASSETS = [
  ...ASSETS.backgrounds,
  ASSETS.tiles.empty, ASSETS.tiles.lit, ASSETS.tiles.solved,
  ASSETS.lantern, ASSETS.rock, ASSETS.hint,
  ASSETS.buttons.home, ASSETS.buttons.levels, ASSETS.buttons.move
];
const copy = {
  tr: { continue: 'Devam et', start: 'Başla', levels: 'Bölümler', store: 'Mağaza', settings: 'Ayarlar', hint: 'İpucu', restart: 'Yenile', completed: 'Bölüm Tamamlandı', completedShort: 'tamamlandı', stars: 'yıldız', level: 'Bölüm', homeSubtitle: 'Ay ışığında bahçeyi aydınlat', next: 'Devam', newLayer: 'Yeni Katman Açıldı', firstLevel: 'İlk bölüme başla', moves: 'Hamle', locked: 'Kilitli', open: 'Açık', removeAds: 'Reklamları Kaldır', restore: 'Satın Alımları Geri Yükle', testMode: 'Expo Go test modu — gerçek ödeme veya reklam yok.', language: 'Dil', music: 'Müzik', sound: 'Ses efektleri', vibration: 'Titreşim' },
  en: { continue: 'Continue', start: 'Start', levels: 'Levels', store: 'Store', settings: 'Settings', hint: 'Hint', restart: 'Restart', completed: 'Level Complete', completedShort: 'completed', stars: 'stars', level: 'Level', homeSubtitle: 'Light the garden under the moonlight', next: 'Continue', newLayer: 'New Layer Unlocked', firstLevel: 'Play first level', moves: 'Moves', locked: 'Locked', open: 'Open', removeAds: 'Remove Ads', restore: 'Restore Purchases', testMode: 'Expo Go test mode — no real purchase or ad.', language: 'Language', music: 'Music', sound: 'Sound effects', vibration: 'Vibration' }
};
const STORE_PACKAGES = {
  hints: [
    { productKey: 'hints10', amount: 10, price: '₺29,99', tier: 'Başlangıç', tierEn: 'Starter' },
    { productKey: 'hints30', amount: 30, price: '₺69,99', tier: 'Avantajlı', tierEn: 'Value', featured: true },
    { productKey: 'hints75', amount: 75, price: '₺129,99', tier: 'Büyük', tierEn: 'Large' }
  ],
  layers: [
    { productKey: 'layer20', amount: 20, price: '₺39,99', tier: 'Başlangıç', tierEn: 'Starter' },
    { productKey: 'layer60', amount: 60, price: '₺89,99', tier: 'Avantajlı', tierEn: 'Value', featured: true },
    { productKey: 'layer150', amount: 150, price: '₺169,99', tier: 'Büyük', tierEn: 'Large' }
  ]
};

function Btn({ children, onPress, primary, disabled, style, icon, iconOnly = false, tile = false }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = (toValue) => Animated.spring(scale, { toValue, friction: 6, tension: 260, useNativeDriver: true }).start();
  return <Pressable accessibilityRole="button" accessibilityLabel={typeof children === 'string' ? children : undefined} disabled={disabled} onPress={onPress} onPressIn={() => press(.94)} onPressOut={() => press(1)} style={({ pressed }) => [styles.btn, iconOnly && styles.iconBtn, primary && styles.btnPrimary, disabled && styles.disabled, pressed && styles.pressed, style]}><Animated.View pointerEvents="none" style={[styles.btnContent, tile && styles.tileContent, iconOnly && styles.iconOnlyContent, { transform: [{ scale }] }]}>{icon && <Image source={icon} style={[styles.btnIcon, tile && styles.tileIcon, iconOnly && styles.btnIconOnly]}/>}{!iconOnly ? <Text numberOfLines={2} style={[styles.btnText, primary && styles.btnPrimaryText]}>{children}</Text> : null}</Animated.View></Pressable>;
}
function Wallet({ save }) {
  return <View style={styles.wallet}><View style={styles.coin}><Image source={ASSETS.hint} style={styles.coinImage}/><Text style={styles.coinText}>{save.hintCoins}</Text></View><View style={styles.coin}><Image source={ASSETS.crystal} style={styles.coinImage}/><Text style={styles.coinText}>{save.layerCoins}</Text></View></View>;
}

function GameCell({ id, size, rock, lamp, lit, hinted, compact, celebrating, onPress }) {
  const lampPulse = useRef(new Animated.Value(lamp ? 1 : .76)).current;
  const lampOpacity = useRef(new Animated.Value(lamp ? 1 : 0)).current;
  const lightOpacity = useRef(new Animated.Value(lit ? 1 : 0)).current;
  const placementBurst = useRef(new Animated.Value(1)).current;
  const removalBurst = useRef(new Animated.Value(1)).current;
  const previousLamp = useRef(lamp);
  const lampScale = compact ? 1.015 : 1.055;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(lampPulse, { toValue: lamp ? lampScale : .76, friction: lamp ? 9 : 7, tension: lamp ? 88 : 120, useNativeDriver: true }),
      Animated.timing(lampOpacity, { toValue: lamp ? 1 : 0, duration: lamp ? 280 : 130, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    ]).start();
    if (lamp && !previousLamp.current) {
      placementBurst.stopAnimation();
      placementBurst.setValue(0);
      requestAnimationFrame(() => Animated.timing(placementBurst, { toValue: 1, duration: 780, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start());
    } else if (!lamp && previousLamp.current) {
      removalBurst.stopAnimation();
      removalBurst.setValue(0);
      requestAnimationFrame(() => Animated.timing(removalBurst, { toValue: 1, duration: 430, easing: Easing.out(Easing.quad), useNativeDriver: true }).start());
    }
    previousLamp.current = lamp;
  }, [lamp, lampOpacity, lampPulse, lampScale, placementBurst, removalBurst]);
  useEffect(() => {
    Animated.timing(lightOpacity, { toValue: lit ? 1 : 0, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [lightOpacity, lit]);
  useEffect(() => {
    if (!celebrating || !lamp) return;
    const [row, col] = id.split(',').map(Number);
    Animated.sequence([
      Animated.delay((row + col) * 65),
      Animated.spring(lampPulse, { toValue: compact ? 1.1 : 1.16, friction: 4, tension: 150, useNativeDriver: true }),
      Animated.spring(lampPulse, { toValue: lampScale, friction: 5, tension: 110, useNativeDriver: true })
    ]).start();
  }, [celebrating, compact, id, lamp, lampPulse, lampScale]);
  return <Pressable disabled={rock || celebrating} onPress={onPress}>
    <View style={[styles.cell, { width: size, height: size }, rock && styles.cellRock, hinted && styles.cellHint]}>
      {rock ? <Image source={ASSETS.rock} style={[styles.tileAsset, compact && styles.tileAssetCompact]}/> : <><Image source={ASSETS.tiles.empty} style={styles.tileFloor}/><Animated.Image source={ASSETS.tiles.lit} style={[styles.tileFloor, { opacity: lightOpacity }]}/><Animated.View style={[styles.lightHalo, { opacity: lightOpacity }]}/><Animated.View pointerEvents="none" style={[styles.placementGlow, { opacity: placementBurst.interpolate({ inputRange: [0, .3, .78, 1], outputRange: [.62, .48, .12, 0] }), transform: [{ scale: placementBurst.interpolate({ inputRange: [0, 1], outputRange: [.48, 1.12] }) }] }]}/><Animated.View pointerEvents="none" style={[styles.placementRing, { opacity: placementBurst.interpolate({ inputRange: [0, .55, 1], outputRange: [.7, .4, 0] }), transform: [{ scale: placementBurst.interpolate({ inputRange: [0, 1], outputRange: [.5, 1.28] }) }] }]}/><Animated.View pointerEvents="none" style={[styles.placementRingOuter, { opacity: placementBurst.interpolate({ inputRange: [0, .4, 1], outputRange: [.42, .28, 0] }), transform: [{ scale: placementBurst.interpolate({ inputRange: [0, 1], outputRange: [.42, 1.45] }) }] }]}/><Animated.View pointerEvents="none" style={[styles.removalGlow, { opacity: removalBurst.interpolate({ inputRange: [0, .35, 1], outputRange: [.72, .45, 0] }), transform: [{ scale: removalBurst.interpolate({ inputRange: [0, 1], outputRange: [1.05, .18] }) }] }]}/><Animated.View pointerEvents="none" style={[styles.removalRing, { opacity: removalBurst.interpolate({ inputRange: [0, .55, 1], outputRange: [.9, .55, 0] }), transform: [{ scale: removalBurst.interpolate({ inputRange: [0, 1], outputRange: [1.18, .35] }) }, { rotate: removalBurst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '70deg'] }) }] }]}/><Animated.Image source={ASSETS.lantern} style={[styles.tileAsset, compact && styles.tileAssetCompact, { opacity: lampOpacity, transform: [{ scale: lampPulse }] }]}/>{lit && !lamp ? <Text style={styles.spark}>·</Text> : null}</>}
    </View>
  </Pressable>;
}

function AnimatedStars({ count }) {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    values.forEach((value) => value.setValue(0));
    Animated.stagger(190, values.map((value) => Animated.spring(value, { toValue: 1, friction: 5, useNativeDriver: true }))).start();
  }, [count, values]);
  return <View style={styles.starRow}>{values.map((value, i) => <Animated.Image key={i} source={i < count ? ASSETS.rewards.earned : ASSETS.rewards.empty} style={[styles.bigStarAsset, { opacity: value, transform: [{ scale: value }] }]}/>)}</View>;
}

function StarRating({ count }) {
  return <View style={styles.textStarRow}>{[0, 1, 2].map((i) => <Text key={i} style={[styles.textStar, i < count ? styles.textStarEarned : styles.textStarEmpty]}>★</Text>)}</View>;
}

function GameStat({ icon, value, label }) {
  return <View style={styles.gameStat}><Image source={icon} style={styles.gameStatIcon}/><View><Text style={styles.gameStatValue}>{value}</Text><Text style={styles.gameStatLabel}>{label}</Text></View></View>;
}

function ScreenHeader({ title, subtitle }) {
  return <View style={styles.headerTitle}><Text numberOfLines={1} style={styles.headerTitleText}>{title}</Text><Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text></View>;
}

function BreathingGlow({ color, style }) {
  const pulse = useRef(new Animated.Value(.32)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: .68, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: .32, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);
  return <Animated.View pointerEvents="none" style={[styles.breathingGlow, style, { backgroundColor: color, opacity: pulse }]}/>;
}

function FloatingIcon({ source }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -8, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    ])).start();
  }, [y]);
  return <Animated.Image source={source} style={[styles.floatingIcon, { transform: [{ translateY: y }] }]}/>;
}

function AppContent() {
  const { width, height } = useWindowDimensions();
  const [save, setSave] = useState(null);
  const [screen, setScreen] = useState('splash');
  const [introPage, setIntroPage] = useState(0);
  const [tutorialLamp, setTutorialLamp] = useState(null);
  const [activeLayer, setActiveLayer] = useState(0);
  const [game, setGame] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [unlockLayer, setUnlockLayer] = useState(null);
  const [continueVisible, setContinueVisible] = useState(true);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const splashIconScale = useRef(new Animated.Value(.72)).current;
  const splashTitleOpacity = useRef(new Animated.Value(0)).current;
  const splashTitleLift = useRef(new Animated.Value(16)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenLift = useRef(new Animated.Value(0)).current;
  const screenScale = useRef(new Animated.Value(1)).current;
  const transitionLock = useRef(false);
  const levelListRef = useRef(null);
  const layerTabsRef = useRef(null);
  const layerTabsOffset = useRef(0);
  const mapFocusedLayer = useRef(null);
  const mapFocusTimer = useRef(null);
  const completionOpacity = useRef(new Animated.Value(0)).current;
  const completionScale = useRef(new Animated.Value(.86)).current;
  const completionBurst = useRef(new Animated.Value(0)).current;
  const celebrationLock = useRef(false);
  const solveSweepX = useRef(new Animated.Value(-420)).current;
  const solveGlowOpacity = useRef(new Animated.Value(0)).current;
  const introOpacity = useRef(new Animated.Value(1)).current;
  const introShift = useRef(new Animated.Value(0)).current;
  const lang = save?.settings.language || 'tr';
  const tx = copy[lang];
  const audio = useGameAudio(save?.settings);

  const transitionTo = useCallback((nextScreen, beforeSwap, force = false) => {
    if (transitionLock.current) return;
    if (!force && nextScreen === screen) { if (beforeSwap) beforeSwap(); return; }
    transitionLock.current = true;
    const safetyUnlock = setTimeout(() => { transitionLock.current = false; }, 900);
    Animated.parallel([
      Animated.timing(screenOpacity, { toValue: 0, duration: 170, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(screenLift, { toValue: -9, duration: 170, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(screenScale, { toValue: .985, duration: 170, easing: Easing.in(Easing.cubic), useNativeDriver: true })
    ]).start(() => {
      if (beforeSwap) beforeSwap();
      screenOpacity.setValue(0);
      screenLift.setValue(12);
      screenScale.setValue(.988);
      if (nextScreen !== screen) setScreen(nextScreen);
      requestAnimationFrame(() => Animated.parallel([
        Animated.timing(screenOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(screenLift, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(screenScale, { toValue: 1, friction: 8, tension: 92, useNativeDriver: true })
      ]).start(() => { clearTimeout(safetyUnlock); transitionLock.current = false; }));
    });
  }, [screen, screenLift, screenOpacity, screenScale]);

  useEffect(() => {
    if (!completion) return;
    completionOpacity.setValue(0);
    completionScale.setValue(.86);
    completionBurst.setValue(0);
    Animated.parallel([
      Animated.timing(completionOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(completionScale, { toValue: 1, friction: 6, tension: 95, useNativeDriver: true }),
      Animated.timing(completionBurst, { toValue: 1, duration: 1050, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    ]).start();
  }, [completion?.stars, completionBurst, completionOpacity, completionScale]);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.spring(splashIconScale, { toValue: 1, friction: 6, tension: 75, useNativeDriver: true }),
        Animated.timing(splashTitleOpacity, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(splashTitleLift, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      ])
    ]).start();
  }, [splashIconScale, splashTitleLift, splashTitleOpacity]);

  useEffect(() => {
    introOpacity.setValue(0);
    introShift.setValue(18);
    Animated.parallel([
      Animated.timing(introOpacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(introShift, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    ]).start();
  }, [introOpacity, introPage, introShift]);

  const updateSave = useCallback((updater) => {
    setSave((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      persistSave(next).catch(() => {});
      return next;
    });
  }, []);

  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const adsInitialization = nativeServices.initialize().catch(() => false);
      const minimumSplash = new Promise((resolve) => setTimeout(resolve, 900));
      const [loaded] = await Promise.all([
        loadSave(),
        Asset.loadAsync(STARTUP_ASSETS).catch(() => []),
        minimumSplash,
        adsInitialization
      ]);
      if (!mounted) return;
      setSave(loaded);
      setPrivacyOptionsRequired(nativeServices.isPrivacyOptionsRequired());
      if (!economyIsSolvable()) console.warn('Layer economy is not solvable without purchases.');
      if (REMOTE_CONFIG_URL) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        fetch(REMOTE_CONFIG_URL, { signal: controller.signal }).catch(() => {}).finally(() => clearTimeout(timer));
      }
      Animated.timing(splashOpacity, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => setScreen(loaded.introSeen ? 'home' : 'intro'));
    })();
    return () => { mounted = false; clearTimeout(toastTimer.current); };
  }, [splashOpacity]);

  const firstOpen = useCallback((data = save) => {
    if (!data) return 0;
    for (let i = 0; i < TOTAL_LEVELS; i += 1) if (i < data.unlockedLevels && !data.completed[i]) return i;
    return Math.min(TOTAL_LEVELS - 1, data.unlockedLevels - 1);
  }, [save]);

  useEffect(() => {
    if (screen !== 'map' || !save) return;
    mapFocusedLayer.current = null;
    const storedIndex = Number.isInteger(save.lastPlayedLevel) ? save.lastPlayedLevel : save.currentLevel;
    const levelIndex = Math.max(0, Math.min(TOTAL_LEVELS - 1, Number.isInteger(storedIndex) ? storedIndex : 0));
    const savedLayer = Number.isInteger(save.lastSelectedLayer) ? save.lastSelectedLayer : layerIndexFor(levelIndex);
    const layerIndex = Math.max(0, Math.min(LAYERS.length - 1, savedLayer));
    setActiveLayer(layerIndex);
    clearTimeout(mapFocusTimer.current);
    mapFocusTimer.current = setTimeout(() => {
      const tabOffset = Math.max(0, layerIndex * 116 - width / 2 + 54);
      layerTabsOffset.current = tabOffset;
      layerTabsRef.current?.scrollTo({ x: tabOffset, animated: false });
      const localIndex = levelIndex - LAYERS[layerIndex].from;
      const rowIndex = Math.floor(localIndex / 3);
      const cardWidth = Math.max(96, (width - 20) * .315);
      const rowHeight = cardWidth / 1.16 + 8;
      levelListRef.current?.scrollToOffset({ offset: Math.max(0, (rowIndex - 1) * rowHeight), animated: false });
    }, 180);
    return () => clearTimeout(mapFocusTimer.current);
  }, [save?.currentLevel, save?.lastPlayedLevel, screen, width]);

  const startLevel = useCallback((index) => {
    updateSave((current) => current.lastPlayedLevel === index ? current : { ...current, lastPlayedLevel: index });
    transitionTo('game', () => {
      celebrationLock.current = false;
      setCelebrating(false);
      setCompletion(null);
      setGame({ index, level: createLevel(index), lamps: new Set(), moves: 0, hintCell: '' });
    }, screen === 'game');
  }, [screen, transitionTo, updateSave]);

  const vibrate = useCallback((kind = 'light') => {
    if (!save?.settings.vibration) return;
    const type = kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.ImpactFeedbackStyle.Light;
    (kind === 'success' ? Haptics.notificationAsync(type) : Haptics.impactAsync(type)).catch(() => {});
  }, [save]);

  const finish = useCallback((snapshot) => {
    if (completion || celebrationLock.current) return;
    celebrationLock.current = true;
    const first = !save.completed[snapshot.index];
    const stars = starsFor(snapshot.moves, snapshot.level.lampCount);
    let nextSave = { ...save, completed: { ...save.completed }, stars: { ...save.stars } };
    nextSave.stars[snapshot.index] = Math.max(nextSave.stars[snapshot.index] || 0, stars);
    if (first) {
      nextSave.completed[snapshot.index] = true;
      nextSave.hintCoins += 1;
      nextSave.layerCoins += 1;
      nextSave.uniqueCompletions += 1;
      nextSave.unlockedLevels = Math.max(nextSave.unlockedLevels, Math.min(TOTAL_LEVELS, snapshot.index + 2));
      nextSave.currentLevel = firstOpen(nextSave);
    }
    updateSave(nextSave);
    const third = first && nextSave.uniqueCompletions % 3 === 0;
    setContinueVisible(!third);
    if (third) setTimeout(() => setContinueVisible(true), 3000);
    setCelebrating(true);
    solveSweepX.setValue(-420);
    solveGlowOpacity.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(solveGlowOpacity, { toValue: .72, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(620),
        Animated.timing(solveGlowOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
      ]),
      Animated.timing(solveSweepX, { toValue: 420, duration: 1080, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })
    ]).start(() => {
      setCelebrating(false);
      celebrationLock.current = false;
      setCompletion({ first, stars, doubled: false, replay: !first, uniqueCompletions: nextSave.uniqueCompletions });
    });
    audio.success();
    vibrate('success');
  }, [audio, completion, firstOpen, save, solveGlowOpacity, solveSweepX, updateSave, vibrate]);

  const toggleCell = useCallback((cell) => {
    if (celebrationLock.current) return;
    setGame((current) => {
      if (!current || current.level.rocks.has(cell) || current.level.voids.has(cell)) return current;
      const lamps = new Set(current.lamps);
      const removing = lamps.has(cell);
      const blocked = new Set([...current.level.voids, ...current.level.rocks]);
      const beforeCounts = lineCounts(current.level.rows, current.level.cols, litCells(current.level.rows, current.level.cols, blocked, current.lamps));
      if (removing) lamps.delete(cell);
      else if (lamps.size < current.level.lampCount) lamps.add(cell);
      else { notify(lang === 'tr' ? `En fazla ${current.level.lampCount} fener` : `Maximum ${current.level.lampCount} lanterns`); return current; }
      const next = { ...current, lamps, moves: current.moves + 1, hintCell: '' };
      const solved = isSolved(next.level, lamps);
      if (removing) audio.remove(); else audio.place();
      if (!removing && !solved) {
        const afterCounts = lineCounts(current.level.rows, current.level.cols, litCells(current.level.rows, current.level.cols, blocked, lamps));
        const completedBefore = beforeCounts.rows.filter((value, i) => value === current.level.target.rows[i]).length + beforeCounts.cols.filter((value, i) => value === current.level.target.cols[i]).length;
        const completedAfter = afterCounts.rows.filter((value, i) => value === current.level.target.rows[i]).length + afterCounts.cols.filter((value, i) => value === current.level.target.cols[i]).length;
        if (completedAfter > completedBefore) setTimeout(() => audio.line(), 90);
      }
      vibrate();
      if (solved) setTimeout(() => finish(next), 120);
      return next;
    });
  }, [audio, finish, lang, notify, vibrate]);

  const useHint = useCallback(() => {
    if (!game || celebrationLock.current) return;
    if (save.freeHints <= 0 && save.hintCoins < HINT_COST) { notify(lang === 'tr' ? `İpucu için ${HINT_COST} ipucu parası gerekli` : `${HINT_COST} hint coins required`); return; }
    const missing = [...game.level.solution].find((cell) => !game.lamps.has(cell));
    if (!missing) return;
    const lamps = new Set(game.lamps);
    if (lamps.size >= game.level.lampCount) {
      const wrong = [...lamps].find((cell) => !game.level.solution.has(cell));
      if (wrong) lamps.delete(wrong);
    }
    lamps.add(missing);
    updateSave((current) => ({ ...current, freeHints: current.freeHints > 0 ? current.freeHints - 1 : 0, hintCoins: current.freeHints > 0 ? current.hintCoins : current.hintCoins - HINT_COST }));
    const next = { ...game, lamps, moves: game.moves + 1, hintCell: missing };
    audio.hint();
    setGame(next);
    if (isSolved(next.level, lamps)) setTimeout(() => finish(next), 250);
  }, [audio, finish, game, lang, notify, save, updateSave]);

  const doubleReward = useCallback(async () => {
    if (!completion?.first || completion.doubled) return;
    const result = save.adsRemoved ? { earned: true } : await nativeServices.showRewarded();
    if (!result.earned) return notify(lang === 'tr' ? 'Reklam yüklenemedi; normal devam edebilirsin.' : 'Ad unavailable; you can continue normally.');
    updateSave((current) => ({ ...current, hintCoins: current.hintCoins + 1, layerCoins: current.layerCoins + 1 }));
    setCompletion((current) => ({ ...current, doubled: true }));
  }, [completion, lang, notify, save, updateSave]);

  const continueAfterCompletion = useCallback(async () => {
    const finished = game.index;
    const layerIndex = layerIndexFor(finished);
    const layer = LAYERS[layerIndex];
    const layerFinished = finished === layer.from + layer.count - 1;
    await Promise.race([
      new Promise((resolve) => Animated.parallel([
        Animated.timing(completionOpacity, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(completionScale, { toValue: .9, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      ]).start(resolve)),
      new Promise((resolve) => setTimeout(resolve, 360))
    ]);
    setCompletion(null);
    transitionLock.current = false;
    if (layerFinished && layerIndex + 1 < LAYERS.length && save.unlockedLayers < layerIndex + 2) {
      const nextLayer = LAYERS[layerIndex + 1];
      updateSave((current) => ({ ...current, unlockedLayers: layerIndex + 2, unlockedLevels: Math.max(current.unlockedLevels, nextLayer.from + 1) }));
      setUnlockLayer(layerIndex + 1);
      audio.unlock();
      return;
    }
    if (shouldShowInterstitial(finished, completion.uniqueCompletions, completion.replay, save.adsRemoved)) await nativeServices.showInterstitial();
    if (finished + 1 < save.unlockedLevels) startLevel(finished + 1); else transitionTo('home');
  }, [audio, completion, completionOpacity, completionScale, game, save, startLevel, transitionTo, updateSave]);

  const closeCompletion = useCallback(() => {
    completionOpacity.stopAnimation();
    completionScale.stopAnimation();
    transitionLock.current = false;
    setCompletion(null);
    transitionTo('map');
  }, [completionOpacity, completionScale, transitionTo]);

  const purchase = useCallback(async (offer) => {
    const ids = PRODUCTS[Platform.OS] || PRODUCTS.android;
    const productId = ids[offer.productKey];
    const result = await nativeServices.purchase(productId);
    if (!result.success) return;
    updateSave((current) => ({
      ...current,
      hintCoins: current.hintCoins + (offer.kind === 'hints' ? offer.amount : 0),
      layerCoins: current.layerCoins + (offer.kind === 'layers' ? offer.amount : 0),
      adsRemoved: offer.kind === 'ads' ? true : current.adsRemoved
    }));
    notify(lang === 'tr' ? `${offer.amount || ''} ${offer.kind === 'hints' ? 'ipucu' : offer.kind === 'layers' ? 'kristal' : 'reklamsız sürüm'} eklendi` : 'Test purchase applied');
  }, [lang, notify, updateSave]);

  if (!save || screen === 'splash') return <ImageBackground source={ASSETS.backgrounds[0]} style={styles.appBackground} imageStyle={styles.splashBackground}><Animated.View style={[styles.splash, { opacity: splashOpacity }]}><Animated.Image source={ASSETS.icon} style={[styles.splashIcon, { transform: [{ scale: splashIconScale }] }]}/><Animated.View style={{ opacity: splashTitleOpacity, transform: [{ translateY: splashTitleLift }] }}><Text style={styles.title}>Liva Lights</Text><Text style={[styles.muted, styles.center]}>Gece bahçesi uyanıyor…</Text></Animated.View><View style={styles.loadingTrack}><Animated.View style={[styles.loadingGlow, { transform: [{ scaleX: splashTitleOpacity }] }]}/></View></Animated.View></ImageBackground>;

  const Home = () => {
    const hasLastPlayed = Number.isInteger(save.lastPlayedLevel);
    const index = hasLastPlayed ? Math.max(0, Math.min(TOTAL_LEVELS - 1, save.lastPlayedLevel)) : firstOpen();
    const layer = LAYERS[layerIndexFor(index)];
    const completedCount = Object.keys(save.completed).length;
    const totalStars = Object.values(save.stars).reduce((sum, value) => sum + value, 0);
    return <View style={styles.fill}><View style={styles.top}><Btn icon={ASSETS.buttons.settings} iconOnly onPress={() => transitionTo('settings')}>{tx.settings}</Btn><Wallet save={save}/><Btn icon={ASSETS.buttons.store} iconOnly onPress={() => transitionTo('store')}>{tx.store}</Btn></View><ScrollView contentContainerStyle={styles.home} showsVerticalScrollIndicator={false}><Text style={styles.title}>Liva Lights</Text><Text style={styles.mutedCenter}>{tx.homeSubtitle}</Text><View style={styles.heroPanel}><BreathingGlow color="#EACB91" style={styles.heroGlow}/><FloatingIcon source={ASSETS.heroLantern}/><View style={styles.heroCopy}><Text style={styles.heroChapter}>{lang === 'tr' ? layer.tr : layer.en}</Text><Text style={styles.heroLevel}>{tx.level} {index - layer.from + 1}</Text></View><Btn icon={ASSETS.buttons.play} primary style={styles.bigBtn} onPress={() => startLevel(index)}>{hasLastPlayed || completedCount ? tx.continue : tx.start}</Btn></View><View style={styles.progressStrip}><View style={styles.progressItem}><Image source={ASSETS.rewards.earned} style={styles.progressIcon}/><Text style={styles.progressValue}>{totalStars}</Text><Text style={styles.progressLabel}>{lang === 'tr' ? 'Yıldız' : 'Stars'}</Text></View><View style={styles.progressDivider}/><View style={styles.progressItem}><Image source={ASSETS.buttons.levels} style={styles.progressIcon}/><Text style={styles.progressValue}>{completedCount}/{TOTAL_LEVELS}</Text><Text style={styles.progressLabel}>{lang === 'tr' ? 'Tamamlanan' : 'Completed'}</Text></View></View><View style={styles.menu}><Btn icon={ASSETS.buttons.levels} style={styles.levelsMenuBtn} onPress={() => transitionTo('map')}>{tx.levels}</Btn></View><View style={styles.brandFooter}><View style={styles.brandLogoFrame}><Image source={ASSETS.brandLogo} style={styles.brandLogo}/></View><Text style={styles.brandName}>GÖRSEN GAMES</Text></View></ScrollView></View>;
  };

  const Intro = () => {
    const pages = [
      [lang === 'tr' ? 'Fenerini yerleştir' : 'Place your lantern', lang === 'tr' ? 'Ortadaki hücreye dokun ve ışığın nasıl yayıldığını gör.' : 'Tap the center cell and watch the light spread.'],
      [lang === 'tr' ? 'Sayıları eşleştir' : 'Match the numbers', lang === 'tr' ? 'Üstteki ve soldaki sayılar, aydınlanan hücrelerle eşleşmelidir.' : 'The top and left targets must match the illuminated cells.'],
      [lang === 'tr' ? 'Bahçeyi tamamla' : 'Complete the garden', lang === 'tr' ? 'Harika! Tüm satır ve sütun hedefleri tamamlandı.' : 'Great! Every row and column target is complete.']
    ];
    const page = pages[introPage];
    const lit = tutorialLamp === null ? new Set() : new Set([tutorialLamp, tutorialLamp - 3, tutorialLamp + 3, tutorialLamp - 1, tutorialLamp + 1].filter((cell) => cell >= 0 && cell < 9 && (cell === tutorialLamp || Math.abs(Math.floor(cell / 3) - Math.floor(tutorialLamp / 3)) + Math.abs((cell % 3) - (tutorialLamp % 3)) === 1)));
    const rowCounts = [0, 1, 2].map((row) => [0, 1, 2].filter((col) => lit.has(row * 3 + col)).length);
    const colCounts = [0, 1, 2].map((col) => [0, 1, 2].filter((row) => lit.has(row * 3 + col)).length);
    const targets = [1, 3, 1];
    const solvedTutorial = tutorialLamp === 4;
    return <Animated.View style={[styles.intro, { opacity: introOpacity, transform: [{ translateX: introShift }] }]}>
      <View style={styles.tutorialHeader}><Image source={introPage === 2 ? ASSETS.crystal : ASSETS.lantern} style={styles.tutorialHeaderIcon}/><View style={styles.tutorialHeaderCopy}><Text style={styles.tutorialStep}>{introPage + 1} / 3</Text><Text style={styles.heading}>{page[0]}</Text><Text style={styles.tutorialDescription}>{page[1]}</Text></View></View>
      <View style={styles.tutorialBoardCard}>
        <View style={styles.tutorialTopTargets}><View style={styles.tutorialCorner}/>{targets.map((target, col) => <View key={col} style={[styles.tutorialClue, colCounts[col] === target && styles.tutorialClueDone]}><Text style={styles.tutorialClueText}>{target}</Text></View>)}</View>
        {[0, 1, 2].map((row) => <View key={row} style={styles.tutorialBoardRow}><View style={[styles.tutorialClue, rowCounts[row] === targets[row] && styles.tutorialClueDone]}><Text style={styles.tutorialClueText}>{targets[row]}</Text></View>{[0, 1, 2].map((col) => { const index = row * 3 + col; const hasLamp = tutorialLamp === index; return <Pressable key={index} onPress={() => { setTutorialLamp(hasLamp ? null : index); if (hasLamp) audio.remove(); else audio.place(); vibrate('light'); }} style={({ pressed }) => [styles.tutorialCell, lit.has(index) && styles.tutorialCellLit, index === 4 && !solvedTutorial && styles.tutorialCellGuide, pressed && styles.pressed]}>{hasLamp ? <Image source={ASSETS.lantern} style={styles.tutorialCellLantern}/> : lit.has(index) ? <Text style={styles.tutorialSpark}>·</Text> : null}</Pressable>; })}</View>)}
        <Text style={[styles.tutorialStatus, solvedTutorial && styles.tutorialStatusDone]}>{solvedTutorial ? (lang === 'tr' ? '✓ Tüm hedefler eşleşti' : '✓ All targets match') : (lang === 'tr' ? 'Ortadaki hücreye dokun' : 'Tap the center cell')}</Text>
      </View>
      <Btn icon={ASSETS.buttons.play} primary style={styles.tutorialContinue} disabled={!solvedTutorial} onPress={() => { if (introPage < 2) setIntroPage(introPage + 1); else { updateSave({ ...save, introSeen: true }); transitionTo('home'); } }}>{introPage === 2 ? (lang === 'tr' ? 'Oyuna başla' : 'Start playing') : (lang === 'tr' ? 'Devam' : 'Continue')}</Btn>
    </Animated.View>;
  };

  const MapScreen = () => {
    const layer = LAYERS[activeLayer];
    const locked = activeLayer >= save.unlockedLayers;
    const items = Array.from({ length: layer.count }, (_, i) => layer.from + i);
    const completedInLayer = items.filter((item) => save.completed[item]).length;
    const starsInLayer = items.reduce((sum, item) => sum + (save.stars[item] || 0), 0);
    const progress = Math.round((completedInLayer / layer.count) * 100);
    const focusedIndex = Number.isInteger(save.lastPlayedLevel) ? Math.max(0, Math.min(TOTAL_LEVELS - 1, save.lastPlayedLevel)) : Math.max(0, Math.min(TOTAL_LEVELS - 1, save.currentLevel || 0));
    const selectLayer = (index) => {
      setActiveLayer(index);
      updateSave((current) => current.lastSelectedLayer === index ? current : { ...current, lastSelectedLayer: index });
    };
    const focusCurrentRow = () => {
      if (layerIndexFor(focusedIndex) !== activeLayer) return;
      if (mapFocusedLayer.current === activeLayer) return;
      mapFocusedLayer.current = activeLayer;
      const rowIndex = Math.floor((focusedIndex - layer.from) / 3);
      const cardWidth = Math.max(96, (width - 20) * .315);
      const rowHeight = cardWidth / 1.16 + 8;
      requestAnimationFrame(() => levelListRef.current?.scrollToOffset({ offset: Math.max(0, (rowIndex - 1) * rowHeight), animated: false }));
    };
    const unlock = () => {
      if (save.layerCoins < layer.cost) return notify(lang === 'tr' ? 'Yeterli katman parası yok' : 'Not enough layer coins');
      updateSave((current) => ({ ...current, layerCoins: current.layerCoins - layer.cost, unlockedLayers: Math.max(current.unlockedLayers, activeLayer + 1), unlockedLevels: Math.max(current.unlockedLevels, layer.from + 1) }));
    };
    return <View style={[styles.fill, styles.levelsScreen]}>
      <BreathingGlow color={layer.color} style={styles.levelGlowOne}/><BreathingGlow color="#6FA8FF" style={styles.levelGlowTwo}/>
      <View style={styles.mapHeader}>
        <Btn icon={ASSETS.buttons.home} iconOnly onPress={() => transitionTo('home')}>Ana sayfa</Btn>
        <Wallet save={save}/>
      </View>
      <View style={styles.layerSelector}>
        <Text style={styles.layerSelectorLabel}>{lang === 'tr' ? 'BAHÇELER' : 'GARDENS'}</Text>
        <ScrollView ref={layerTabsRef} horizontal contentOffset={{ x: layerTabsOffset.current, y: 0 }} onScroll={(event) => { layerTabsOffset.current = event.nativeEvent.contentOffset.x; }} scrollEventThrottle={16} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerTabs}>{LAYERS.map((item, i) => { const selected = i === activeLayer; return <Pressable key={item.id} onPress={() => selectLayer(i)} style={[styles.layerTab, selected && styles.layerTabSelected, selected && { backgroundColor: item.color }]}><Text style={[styles.layerTabIndex, selected && styles.layerTabSelectedText]}>{i + 1}</Text><Text numberOfLines={1} style={[styles.layerTabText, selected && styles.layerTabSelectedText]}>{lang === 'tr' ? item.tr : item.en}</Text>{selected && <View style={styles.layerSelectedMark}/>}<React.Fragment>{!selected && i >= save.unlockedLayers ? <Text style={styles.layerLock}>●</Text> : null}</React.Fragment></Pressable>; })}</ScrollView>
      </View>
      <View style={styles.levelHeroCard}>
        <View style={[styles.levelHeroIconFrame, { borderColor: layer.color }]}><View style={[styles.levelHeroIconGlow, { backgroundColor: layer.color }]}/><Text style={styles.levelHeroMoon}>☾</Text></View>
        <View style={styles.levelHeroContent}><Text style={styles.levelHeroTitle}>{lang === 'tr' ? layer.tr : layer.en}</Text><Text style={styles.levelHeroSubtitle}>{completedInLayer}/{layer.count} {tx.completedShort} · {starsInLayer}/{layer.count * 3} {tx.stars}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: layer.color }]}/></View></View>
        {locked ? <Btn icon={ASSETS.crystal} onPress={unlock}>{layer.cost}</Btn> : <View style={styles.percentBadge}><Text style={styles.percentText}>%{progress}</Text></View>}
      </View>
      <Text style={styles.sectionLabel}>{locked ? tx.locked : (lang === 'tr' ? 'BİR BÖLÜM SEÇ' : 'CHOOSE A LEVEL')}</Text>
      <FlatList ref={levelListRef} key={`layer-${activeLayer}`} data={items} numColumns={3} keyExtractor={String} contentContainerStyle={styles.levelGrid} columnWrapperStyle={styles.levelRow} showsVerticalScrollIndicator={false} initialNumToRender={12} maxToRenderPerBatch={9} windowSize={7} removeClippedSubviews={false} onContentSizeChange={focusCurrentRow} renderItem={({ item }) => {
        const open = item < save.unlockedLevels && activeLayer < save.unlockedLayers;
        const star = save.stars[item] || 0;
        const hasLastPlayed = Number.isInteger(save.lastPlayedLevel);
        const current = item === (hasLastPlayed ? save.lastPlayedLevel : firstOpen());
        return <Pressable disabled={!open} onPress={() => startLevel(item)} style={({ pressed }) => [styles.levelCard, save.completed[item] && styles.levelCardDone, current && styles.levelCardCurrent, !open && styles.levelCardLocked, pressed && styles.levelPressed]}><View style={[styles.levelCardColor, { backgroundColor: layer.color }]}/><View style={styles.levelCardInnerBorder}/>{current && <View style={styles.nextRibbon}><Text style={styles.nextRibbonText}>{hasLastPlayed ? (lang === 'tr' ? 'SON OYNANAN' : 'LAST PLAYED') : (lang === 'tr' ? 'SIRADAKİ' : 'NEXT')}</Text></View>}<View style={styles.levelCardTop}><View style={[styles.levelNumberCircle, save.completed[item] && styles.levelNumberDone]}><Text style={styles.levelCardNumber}>{open ? item - layer.from + 1 : '•'}</Text></View><StarRating count={open ? star : 0}/></View>{save.completed[item] && <Text style={styles.completedLabel}>{lang === 'tr' ? 'TAMAM' : 'DONE'}</Text>}</Pressable>;
      }}/>
    </View>;
  };

  const GameScreen = () => {
    if (!game) return null;
    const { level, lamps } = game;
    const blocked = new Set([...level.voids, ...level.rocks]);
    const lit = litCells(level.rows, level.cols, blocked, lamps);
    const counts = lineCounts(level.rows, level.cols, lit);
    const clueSize = 28;
    const gap = Math.max(level.rows, level.cols) >= 6 ? 3 : 6;
    const availableWidth = Math.max(210, Math.min(width - clueSize - 54, 520));
    const availableHeight = Math.max(210, Math.min(height - 285, 520));
    const cell = Math.max(26, Math.min(Math.floor((availableWidth - gap * (level.cols - 1)) / level.cols), Math.floor((availableHeight - gap * (level.rows - 1)) / level.rows)));
    const boardWidth = cell * level.cols + gap * (level.cols - 1);
    const boardHeight = cell * level.rows + gap * (level.rows - 1);
    const layer = LAYERS[layerIndexFor(game.index)];
    const playableCells = level.rows * level.cols - level.rocks.size - level.voids.size;
    const lightPercent = Math.round((lit.size / playableCells) * 100);
    return <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.gameScroll}>
      <BreathingGlow color={layer.color} style={styles.gameGlowOne}/><BreathingGlow color="#F6D26C" style={styles.gameGlowTwo}/>
      <View style={styles.gameTop}>
        <View style={styles.gameNav}><Btn icon={ASSETS.buttons.home} iconOnly disabled={celebrating} onPress={() => transitionTo('home')}>Ana sayfa</Btn><Btn icon={ASSETS.buttons.levels} iconOnly disabled={celebrating} onPress={() => transitionTo('map')}>Bölümler</Btn></View>
        <View style={styles.gameTitle}><Text style={styles.gameLevelTitle}>{tx.level} {game.index - layer.from + 1}</Text><Text style={styles.gameLayerName}>{lang === 'tr' ? layer.tr : layer.en}</Text></View>
        <View style={styles.gameHeaderActions}><View style={styles.hintWallet}><Image source={ASSETS.hint} style={styles.hintWalletIcon}/><Text style={styles.hintWalletText}>{save.hintCoins}</Text></View><Btn icon={ASSETS.buttons.settings} iconOnly disabled={celebrating} onPress={() => transitionTo('settings')}>{tx.settings}</Btn></View>
      </View>
      <View style={styles.gameStats}>
        <GameStat icon={ASSETS.lantern} value={`${lamps.size}/${level.lampCount}`} label={lang === 'tr' ? 'FENER' : 'LANTERNS'}/>
        <GameStat icon={ASSETS.buttons.move} value={game.moves} label={tx.moves.toUpperCase()}/>
        <GameStat icon={ASSETS.rock} value={level.rocks.size} label={lang === 'tr' ? 'TAŞ' : 'ROCKS'}/>
      </View>
      <View style={[styles.gameBoardPanel, celebrating && styles.gameBoardPanelCelebrating]}>
      {celebrating && <><Animated.View pointerEvents="none" style={[styles.solveBorderGlow, { opacity: solveGlowOpacity }]}/><Animated.View pointerEvents="none" style={[styles.solveSweep, { opacity: solveGlowOpacity, transform: [{ translateX: solveSweepX }, { rotate: '-12deg' }] }]}/>{[[18, 18], [82, 9], [91, 72], [12, 80], [50, 5], [95, 42], [7, 48], [55, 91]].map(([left, top], i) => <Animated.View key={i} pointerEvents="none" style={[styles.solveSpark, { left: `${left}%`, top: `${top}%`, opacity: solveGlowOpacity, transform: [{ scale: i % 2 ? .7 : 1 }] }]}/>)}</>}
      <View style={[styles.panelCorner, styles.panelCornerTL]}/><View style={[styles.panelCorner, styles.panelCornerTR]}/><View style={[styles.panelCorner, styles.panelCornerBL]}/><View style={[styles.panelCorner, styles.panelCornerBR]}/>
      <View style={styles.boardHeading}><View style={styles.boardHeadingCopy}><Text style={styles.boardKicker}>{lang === 'tr' ? 'GECE GÖREVİ' : 'NIGHT MISSION'}</Text><Text style={styles.boardTitle}>{lang === 'tr' ? 'Bahçeyi Aydınlat' : 'Light the Garden'}</Text><Text style={styles.boardSubtitle}>{lang === 'tr' ? 'Satır ve sütun hedeflerini eşleştir' : 'Match every row and column target'}</Text></View><View style={styles.boardHeadingActions}><Btn icon={ASSETS.hint} style={styles.boardHintButton} disabled={celebrating} onPress={useHint}>{save.freeHints > 0 ? tx.hint : `${tx.hint}  ³`}</Btn></View></View>
      <View style={styles.lightProgressHeader}><Text style={styles.lightProgressLabel}>{lang === 'tr' ? 'AYDINLATMA' : 'ILLUMINATION'}</Text><Text style={styles.lightProgressValue}>%{lightPercent}</Text></View><View style={styles.lightProgressTrack}><View style={[styles.lightProgressFill, { width: `${lightPercent}%` }]}/></View>
      <View style={styles.puzzleFrame}>
        <View style={styles.puzzleTopRow}>
          <View style={{ width: clueSize, height: clueSize }}/>
          <View style={[styles.clueRow, { width: boardWidth, height: clueSize, gap }]}>{level.target.cols.map((target, i) => <View key={i} style={[styles.clue, { width: cell, height: clueSize }, counts.cols[i] === target && styles.clueOk, counts.cols[i] > target && styles.clueOver, celebrating && styles.clueCelebrated]}><Text style={[styles.bold, celebrating && styles.clueCheck]}>{celebrating ? '✓' : target}</Text></View>)}</View>
        </View>
        <View style={styles.puzzleBottomRow}>
          <View style={[styles.clueColumn, { width: clueSize, height: boardHeight, gap }]}>{level.target.rows.map((target, i) => <View key={i} style={[styles.clue, { width: clueSize, height: cell }, counts.rows[i] === target && styles.clueOk, counts.rows[i] > target && styles.clueOver, celebrating && styles.clueCelebrated]}><Text style={[styles.bold, celebrating && styles.clueCheck]}>{celebrating ? '✓' : target}</Text></View>)}</View>
          <View style={[styles.board, { width: boardWidth, height: boardHeight, gap }]}>{Array.from({ length: level.rows * level.cols }, (_, i) => { const row = Math.floor(i / level.cols), col = i % level.cols, id = `${row},${col}`; return level.voids.has(id) ? <View key={id} style={[styles.cellVoid, { width: cell, height: cell }]}/> : <GameCell key={id} id={id} size={cell} rock={level.rocks.has(id)} lamp={lamps.has(id)} lit={lit.has(id)} hinted={game.hintCell === id} compact={Math.max(level.rows, level.cols) >= 6} celebrating={celebrating} onPress={() => toggleCell(id)}/>; })}</View>
        </View>
      </View>
      </View>
      <Text style={styles.gameTip}>{lang === 'tr' ? 'Bir hücreye dokunarak fener yerleştir veya kaldır.' : 'Tap a cell to place or remove a lantern.'}</Text>
    </ScrollView>;
  };

  const Store = () => <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false}>
    <View style={styles.top}><Btn icon={ASSETS.buttons.back} iconOnly onPress={() => transitionTo('home')}>Geri</Btn><ScreenHeader title={tx.store} subtitle={lang === 'tr' ? 'Gece Pazarı' : 'Night Market'}/><View style={styles.headerSpacer}/></View>
    <View style={styles.screenIntro}><Image source={ASSETS.buttons.store} style={styles.screenIntroIcon}/><View style={styles.screenIntroCopy}><Text style={styles.screenEyebrow}>{lang === 'tr' ? 'AY IŞIĞI KOLEKSİYONU' : 'MOONLIGHT COLLECTION'}</Text><Text style={styles.screenIntroTitle}>{lang === 'tr' ? 'Bahçeni güçlendir' : 'Empower your garden'}</Text><Text style={styles.screenIntroBody}>{lang === 'tr' ? 'Yeni yolları aç, ışığını koru ve gece yolculuğunu kişiselleştir.' : 'Unlock new paths and shape your moonlit journey.'}</Text></View></View>
    <View style={styles.storeComingSoon}><Text style={styles.storeComingSoonTitle}>{lang === 'tr' ? 'YAKINDA' : 'COMING SOON'}</Text><Text style={styles.storeComingSoonText}>{lang === 'tr' ? 'Mağaza hazırlanıyor. Şimdilik hiçbir satın alma işlemi yapılmaz.' : 'The store is being prepared. Purchases are currently disabled.'}</Text></View>
    {[
      { kind: 'hints', title: lang === 'tr' ? 'İPUCU PAKETLERİ' : 'HINT PACKS', icon: ASSETS.hint, unit: lang === 'tr' ? 'İpucu' : 'Hints', description: lang === 'tr' ? 'Zor adımlarda doğru feneri bul.' : 'Find the right lantern on difficult steps.' },
      { kind: 'layers', title: lang === 'tr' ? 'KRİSTAL PAKETLERİ' : 'CRYSTAL PACKS', icon: ASSETS.crystal, unit: lang === 'tr' ? 'Kristal' : 'Crystals', description: lang === 'tr' ? 'Yeni bahçelerin kilidini aç.' : 'Unlock new moonlit gardens.' }
    ].map((group) => <View key={group.kind} style={styles.storeSection}>
      <View style={styles.sectionHeading}><Image source={group.icon} style={styles.storeSectionIcon}/><Text style={styles.sectionHeadingText}>{group.title}</Text><View style={styles.sectionLine}/></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storePackageRow}>
        {STORE_PACKAGES[group.kind].map((offer) => <View key={offer.productKey} style={[styles.storePackage, offer.featured && styles.storePackageFeatured]}>
          {offer.featured && <View style={styles.popularBadge}><Text style={styles.popularBadgeText}>{lang === 'tr' ? 'EN POPÜLER' : 'MOST POPULAR'}</Text></View>}
          <Text style={styles.packageTier}>{lang === 'tr' ? offer.tier : offer.tierEn}</Text>
          <Image source={group.icon} style={styles.packageImage}/>
          <Text style={styles.packageAmount}>{offer.amount}</Text>
          <Text style={styles.packageUnit}>{group.unit}</Text>
          <Text style={styles.packageDescription}>{group.description}</Text>
          <Btn disabled style={styles.packageBuyButton}>{lang === 'tr' ? 'YAKINDA' : 'SOON'}</Btn>
        </View>)}
      </ScrollView>
    </View>)}
    <View style={styles.storeUtilityCard}><Image source={ASSETS.lantern} style={styles.storeUtilityIcon}/><View style={styles.storeUtilityCopy}><Text style={styles.productTitle}>{tx.removeAds}</Text><Text style={styles.productDescription}>{lang === 'tr' ? 'Kesintisiz bir gece yolculuğu.' : 'An uninterrupted night journey.'}</Text></View><Btn disabled icon={ASSETS.buttons.store} style={styles.storeUtilityButton}>{lang === 'tr' ? 'YAKINDA' : 'SOON'}</Btn></View>
  </ScrollView>;

  const Settings = () => {
    const settingNotes = { music: lang === 'tr' ? 'Bahçenin sakin melodisi' : 'The garden’s calm melody', sound: lang === 'tr' ? 'Fener ve dokunuş sesleri' : 'Lantern and touch sounds', vibration: lang === 'tr' ? 'Hafif dokunsal geri bildirim' : 'Gentle haptic feedback' };
    return <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.top}><Btn icon={ASSETS.buttons.back} iconOnly onPress={() => transitionTo('home')}>Geri</Btn><ScreenHeader title={tx.settings} subtitle={lang === 'tr' ? 'Bahçeni kişiselleştir' : 'Personalize your garden'}/><Image source={ASSETS.buttons.settings} style={styles.headerIcon}/></View>
      <View style={styles.screenIntro}><Image source={ASSETS.buttons.settings} style={styles.screenIntroIcon}/><View style={styles.screenIntroCopy}><Text style={styles.screenEyebrow}>{lang === 'tr' ? 'GECE AYARLARI' : 'NIGHT SETTINGS'}</Text><Text style={styles.screenIntroTitle}>{lang === 'tr' ? 'Kendi ritmini seç' : 'Choose your rhythm'}</Text><Text style={styles.screenIntroBody}>{lang === 'tr' ? 'Sesleri, titreşimi ve dili oyun tarzına göre düzenle.' : 'Tune sound, vibration and language to your play style.'}</Text></View></View>
      <View style={styles.sectionHeading}><Text style={styles.sectionHeadingText}>{lang === 'tr' ? 'TERCİHLER' : 'PREFERENCES'}</Text><View style={styles.sectionLine}/></View>
      <View style={styles.settingsCard}><View style={styles.setting}><View style={styles.settingCopy}><Text style={styles.settingTitle}>{tx.language}</Text><Text style={styles.settingNote}>{lang === 'tr' ? 'Arayüz ve açıklama dili' : 'Interface and guidance language'}</Text></View><View style={styles.langRow}><Btn primary={lang === 'tr'} onPress={() => updateSave({ ...save, settings: { ...save.settings, language: 'tr' } })}>TR</Btn><Btn primary={lang === 'en'} onPress={() => updateSave({ ...save, settings: { ...save.settings, language: 'en' } })}>EN</Btn></View></View>{[['music', tx.music], ['sound', tx.sound], ['vibration', tx.vibration]].map(([key, label]) => <View style={styles.setting} key={key}><View style={styles.settingCopy}><Text style={styles.settingTitle}>{label}</Text><Text style={styles.settingNote}>{settingNotes[key]}</Text></View><Switch value={save.settings[key]} onValueChange={(value) => updateSave({ ...save, settings: { ...save.settings, [key]: value } })} trackColor={{ false: '#3B5062', true: COLORS.green }} thumbColor={save.settings[key] ? '#F8E8BA' : '#D7E0E5'}/></View>)}{privacyOptionsRequired && <Btn icon={ASSETS.buttons.settings} style={styles.tutorialBtn} onPress={async () => { const shown = await nativeServices.showPrivacyOptions(); setPrivacyOptionsRequired(nativeServices.isPrivacyOptionsRequired()); if (!shown) notify(lang === 'tr' ? 'Gizlilik seçenekleri şu anda açılamıyor.' : 'Privacy options are currently unavailable.'); }}>{lang === 'tr' ? 'Gizlilik Seçenekleri' : 'Privacy Options'}</Btn>}<Btn icon={ASSETS.buttons.play} style={styles.tutorialBtn} onPress={() => { setTutorialLamp(null); setIntroPage(0); transitionTo('intro'); }}>{lang === 'tr' ? 'Tanıtımı İncele' : 'View Tutorial'}</Btn></View>
    </ScrollView>;
  };

  const visualLayer = screen === 'game' && game ? layerIndexFor(game.index) : screen === 'map' ? activeLayer : 0;
  return <ImageBackground source={ASSETS.backgrounds[visualLayer]} style={styles.appBackground} imageStyle={styles.backgroundImage}><View style={styles.scrim}>
    <Animated.View style={[styles.animatedScreen, { opacity: screenOpacity, transform: [{ translateY: screenLift }, { scale: screenScale }] }]}>{screen === 'intro' && Intro()}{screen === 'home' && Home()}{screen === 'map' && MapScreen()}{screen === 'game' && GameScreen()}{screen === 'store' && Store()}{screen === 'settings' && Settings()}</Animated.View>
    <Animated.View pointerEvents="none" style={[styles.transitionVeil, { opacity: screenOpacity.interpolate({ inputRange: [0, 1], outputRange: [.38, 0] }) }]}/>
    <Modal visible={!!completion} transparent animationType="fade" onRequestClose={closeCompletion}><View style={styles.modalBackdrop}><View pointerEvents="none" style={styles.completionParticles}>{Array.from({ length: 10 }, (_, i) => <Animated.View key={i} style={[styles.completionParticle, { opacity: completionBurst.interpolate({ inputRange: [0, .12, .72, 1], outputRange: [0, 1, .8, 0] }), transform: [{ rotate: `${i * 36}deg` }, { translateY: completionBurst.interpolate({ inputRange: [0, 1], outputRange: [-18, -178] }) }, { scale: completionBurst.interpolate({ inputRange: [0, .2, 1], outputRange: [.35, 1, .7] }) }] }]}/>)}</View><Animated.View style={[styles.modal, styles.completionModal, { borderColor: LAYERS[layerIndexFor(game?.index || 0)].color, opacity: completionOpacity, transform: [{ scale: completionScale }] }]}><Pressable accessibilityRole="button" accessibilityLabel={lang === 'tr' ? 'Kapat' : 'Close'} onPress={closeCompletion} style={styles.completionClose}><Text style={styles.completionCloseText}>×</Text></Pressable>
      <View style={styles.completionHero}><Image source={ASSETS.levelScenes[(game?.index || 0) % ASSETS.levelScenes.length]} style={styles.completionScene}/><View style={styles.completionSceneShade}/><Image source={ASSETS.tiles.solved} style={styles.completionSeal}/><Text style={styles.completionKicker}>{lang === 'tr' ? 'BAHÇE AYDINLANDI' : 'GARDEN ILLUMINATED'}</Text><Text style={styles.completionTitle}>{tx.completed}</Text></View>
      <AnimatedStars count={completion?.stars || 0}/><View style={styles.clueCompletionCard}><View style={styles.clueCompletionItem}><View style={styles.clueCompletionCheck}><Text style={styles.clueCompletionCheckText}>✓</Text></View><View><Text style={styles.clueCompletionTitle}>{lang === 'tr' ? 'Tüm satırlar' : 'All rows'}</Text><Text style={styles.clueCompletionValue}>{game?.level.rows}/{game?.level.rows} {lang === 'tr' ? 'tamamlandı' : 'complete'}</Text></View></View><View style={styles.clueCompletionDivider}/><View style={styles.clueCompletionItem}><View style={styles.clueCompletionCheck}><Text style={styles.clueCompletionCheckText}>✓</Text></View><View><Text style={styles.clueCompletionTitle}>{lang === 'tr' ? 'Tüm sütunlar' : 'All columns'}</Text><Text style={styles.clueCompletionValue}>{game?.level.cols}/{game?.level.cols} {lang === 'tr' ? 'tamamlandı' : 'complete'}</Text></View></View></View><View style={styles.completionSummary}><View><Text style={styles.summaryLabel}>{lang === 'tr' ? 'BÖLÜM' : 'LEVEL'}</Text><Text style={styles.summaryValue}>{game ? game.index - LAYERS[layerIndexFor(game.index)].from + 1 : ''}</Text></View><View style={styles.summaryDivider}/><View><Text style={styles.summaryLabel}>{tx.moves.toUpperCase()}</Text><Text style={styles.summaryValue}>{game?.moves}</Text></View><View style={styles.summaryDivider}/><View><Text style={styles.summaryLabel}>{lang === 'tr' ? 'YILDIZ' : 'STARS'}</Text><Text style={styles.summaryValue}>{completion?.stars || 0}/3</Text></View></View>
      <View style={styles.rewards}><View style={styles.reward}><Image source={ASSETS.hint} style={styles.rewardIcon}/><View><Text style={styles.rewardLabel}>{lang === 'tr' ? 'İPUCU' : 'HINT'}</Text><Text style={styles.rewardText}>+{completion?.doubled ? 2 : completion?.first ? 1 : 0}</Text></View></View><View style={styles.reward}><Image source={ASSETS.crystal} style={styles.rewardIcon}/><View><Text style={styles.rewardLabel}>{lang === 'tr' ? 'KRİSTAL' : 'CRYSTAL'}</Text><Text style={styles.rewardText}>+{completion?.doubled ? 2 : completion?.first ? 1 : 0}</Text></View></View></View>
      <Btn icon={ASSETS.buttons.play} primary style={styles.completionPrimary} onPress={doubleReward}>2× {lang === 'tr' ? 'Ödül' : 'Reward'}</Btn>{continueVisible && <Btn icon={ASSETS.buttons.play} style={styles.modalBtn} onPress={continueAfterCompletion}>{tx.next}</Btn>}
    </Animated.View></View></Modal>
    <Modal visible={unlockLayer !== null} transparent animationType="fade"><View style={styles.modalBackdrop}><View style={styles.modal}><FloatingIcon source={ASSETS.crystal}/><Text style={[styles.heading, styles.center]}>{tx.newLayer}</Text><Text style={styles.title}>{unlockLayer !== null ? (lang === 'tr' ? LAYERS[unlockLayer].tr : LAYERS[unlockLayer].en) : ''}</Text><Btn icon={ASSETS.buttons.play} primary style={styles.bigBtn} onPress={() => { const index = LAYERS[unlockLayer].from; setUnlockLayer(null); startLevel(index); }}>{tx.firstLevel}</Btn></View></View></Modal>
    {!!toast && <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>}
  </View></ImageBackground>;
}

export default function App() {
  return <SafeAreaProvider><StatusBar style="light" backgroundColor={COLORS.bg} translucent={false}/><SafeAreaView style={styles.safe}><AppContent/></SafeAreaView></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  appBackground: { flex: 1 },
  animatedScreen: { flex: 1 },
  fill: { flex: 1 },
  logo: { fontSize: 70, color: COLORS.lamp, textAlign: 'center' },
  center: { textAlign: 'center' },
  movesText: { color: COLORS.muted, textAlign: 'right', fontSize: 12, marginTop: 2 },
  coinImage: { width: 24, height: 24, resizeMode: 'contain' },
  coinText: { color: COLORS.ink, fontWeight: '900' },
  btnPrimaryText: { color: COLORS.bg },
  disabled: { opacity: 0.36 },
  pressed: { opacity: 0.75 },
  intro: { flex: 1, padding: 22, justifyContent: 'center' },
  demo: { alignSelf: 'center', width: 188, flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 24 },
  demoCell: { width: 58, height: 58, borderRadius: 14, backgroundColor: COLORS.tile, alignItems: 'center', justifyContent: 'center' },
  demoLit: { backgroundColor: '#706648' },
  demoAsset: { width: 52, height: 52, resizeMode: 'contain' },
  pager: { color: COLORS.lamp, textAlign: 'center', fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 7, paddingHorizontal: 12, paddingBottom: 12 },
  tab: { flex: 1, borderRadius: 12, backgroundColor: '#17213CDD', padding: 10 },
  tabText: { color: COLORS.ink, textAlign: 'center', fontWeight: '800', fontSize: 12 },
  darkText: { color: COLORS.bg },
  layerCard: { marginHorizontal: 12, marginBottom: 8, padding: 14, borderRadius: 18, backgroundColor: '#17213CDD', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  open: { color: COLORS.green, fontWeight: '800' },
  grid: { padding: 7 },
  level: { flex: 1, aspectRatio: 1, margin: 5, borderRadius: 16, backgroundColor: '#253253EE', alignItems: 'center', justifyContent: 'center' },
  levelDone: { backgroundColor: '#315D54EE' },
  current: { borderWidth: 3, borderColor: COLORS.lamp },
  levelText: { color: COLORS.ink, fontSize: 18, fontWeight: '900' },
  starText: { color: COLORS.lamp, fontSize: 11 },
  puzzleFrame: { alignSelf: 'center' },
  puzzleTopRow: { flexDirection: 'row', gap: 5, alignItems: 'flex-end' },
  puzzleBottomRow: { flexDirection: 'row', gap: 5, alignItems: 'flex-start', marginTop: 5 },
  clueRow: { flexDirection: 'row', gap: 5, flexShrink: 0 },
  clueColumn: { gap: 5, flexShrink: 0 },
  cellHint: { borderWidth: 4, borderColor: COLORS.ink },
  cellText: { color: COLORS.ink, fontSize: 24, fontWeight: '800' },
  spark: { color: '#FFF2A0', fontSize: 30, lineHeight: 30 },
  gameActions: { flexDirection: 'row', gap: 9, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  gameActionButton: { flex: 1 },
  bigStar: { color: COLORS.lamp, fontSize: 48 },
  emptyStar: { color: '#66708D' },
  toast: { position: 'absolute', left: 20, right: 20, bottom: 24, backgroundColor: '#F4F6FF', borderRadius: 13, padding: 12 },
  toastText: { color: COLORS.bg, textAlign: 'center', fontWeight: '800' },
  headerIcon: { width: 48, height: 48, resizeMode: 'contain' },
  headerSpacer: { width: 48, height: 48 },
  loadingTrack: { width: 132, height: 4, marginTop: 22, borderRadius: 3, overflow: 'hidden', backgroundColor: '#FFFFFF18' },
  loadingGlow: { flex: 1, borderRadius: 3, backgroundColor: COLORS.lamp },
  gameScroll: { flexGrow: 1, paddingBottom: 8 },
  menu: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  tileContent: { minHeight: 112, paddingHorizontal: 8, paddingVertical: 8, flexDirection: 'column', gap: 3 },
  tileIcon: { width: 58, height: 58 },
  menuBtn: { width: '48%', minHeight: 112, backgroundColor: '#F2F1ECF2', borderWidth: 1, borderColor: '#F6D26C66', shadowColor: '#000000', shadowOpacity: .28, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  progressItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  progressDivider: { width: 1, height: 32, backgroundColor: '#FFFFFF24', marginHorizontal: 8 },
  assetStarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 1 },
  starAsset: { width: 34, height: 34, resizeMode: 'contain' },
  levelNumberBadge: { minWidth: 34, minHeight: 34, borderRadius: 17, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C1730A8', borderWidth: 1, borderColor: '#FFFFFF1E', marginBottom: 4 },
  levelPressed: { transform: [{ scale: .96 }], opacity: .86 },
  lockedStars: { height: 17 },
  openBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: '#52BA8C22', borderWidth: 1, borderColor: '#52BA8C66' },
  missionPill: { alignSelf: 'center', minHeight: 36, paddingHorizontal: 12, marginBottom: 8, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#FFFFFF12' },
  missionIcon: { width: 28, height: 28, resizeMode: 'contain' },
  mission: { color: '#E9EEFC', textAlign: 'center', fontWeight: '700' },
  movesBadge: { alignSelf: 'center', paddingHorizontal: 13, paddingVertical: 6, borderRadius: 14, backgroundColor: '#FFFFFF10', borderWidth: 1, borderColor: '#FFFFFF18' },
  movesBadgeText: { color: '#E1E7F7', fontWeight: '800' },
  layerLock: { position: 'absolute', right: 6, top: 5, color: '#7F8AA8', fontSize: 7 },
  levelHeroContent: { flex: 1, minWidth: 0 },
  progressTrack: { height: 7, borderRadius: 5, overflow: 'hidden', backgroundColor: '#FFFFFF16' },
  progressFill: { height: 7, borderRadius: 5 },
  percentBadge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF10', borderWidth: 1, borderColor: '#FFFFFF20' },
  percentText: { color: '#F6D26C', fontWeight: '900', fontSize: 13 },
  levelRow: { justifyContent: 'space-between' },
  hintWallet: { minWidth: 48, height: 44, paddingHorizontal: 7, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: '#FFFFFF12', borderWidth: 1, borderColor: '#FFFFFF1C' },
  hintWalletIcon: { width: 27, height: 27, resizeMode: 'contain' },
  hintWalletText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  rockBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  breathingGlow: { position: 'absolute', width: 230, height: 230, borderRadius: 115 },
  levelGlowOne: { right: -145, top: 80 },
  levelGlowTwo: { left: -175, bottom: 40 },
  gameGlowOne: { right: -165, top: 105 },
  gameGlowTwo: { left: -185, bottom: 70 },
  levelHeroIconGlow: { position: 'absolute', width: 55, height: 55, borderRadius: 28, opacity: .25 },
  levelHeroImage: { width: 68, height: 68, resizeMode: 'contain' },
  panelCorner: { position: 'absolute', width: 18, height: 18, borderColor: '#F6D26C88' },
  panelCornerTL: { left: 8, top: 8, borderLeftWidth: 2, borderTopWidth: 2, borderTopLeftRadius: 7 },
  panelCornerTR: { right: 8, top: 8, borderRightWidth: 2, borderTopWidth: 2, borderTopRightRadius: 7 },
  panelCornerBL: { left: 8, bottom: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderBottomLeftRadius: 7 },
  panelCornerBR: { right: 8, bottom: 8, borderRightWidth: 2, borderBottomWidth: 2, borderBottomRightRadius: 7 },
  lightProgressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 6, marginBottom: 4 },
  lightProgressTrack: { height: 6, borderRadius: 4, overflow: 'hidden', marginHorizontal: 6, marginBottom: 12, backgroundColor: '#FFFFFF12' },
  lightProgressFill: { height: 6, borderRadius: 4, backgroundColor: '#F6D26C' },
  clueOk: { backgroundColor: '#32866A', borderColor: '#85E3BA' },
  clueOver: { backgroundColor: '#A74458', borderColor: '#FF9BAC' },
  backgroundImage: { opacity: .72, resizeMode: 'cover' },
  splashBackground: { opacity: .82, resizeMode: 'cover' },
  scrim: { flex: 1, backgroundColor: '#06111DB5' },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#06111D88' },
  splashIcon: { width: 210, height: 210, resizeMode: 'contain', marginBottom: 4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 9, backgroundColor: '#102235D9', borderBottomWidth: 1, borderBottomColor: '#EACB9140' },
  btn: { minHeight: 48, borderRadius: 17, backgroundColor: '#E8EEF0F2', padding: 0, alignItems: 'stretch', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF90', shadowColor: '#020810', shadowOpacity: .3, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  btnPrimary: { backgroundColor: '#EACB91', borderColor: '#FFF2C9' },
  btnContent: { minHeight: 48, flexGrow: 1, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 50, height: 50, minHeight: 50, padding: 0, borderRadius: 17, backgroundColor: '#DDE5E9F2', flexShrink: 0 },
  iconOnlyContent: { minHeight: 50, paddingHorizontal: 6, paddingVertical: 6 },
  btnIcon: { width: 34, height: 34, resizeMode: 'contain' },
  btnIconOnly: { width: 38, height: 38 },
  wallet: { flexDirection: 'row', gap: 6, paddingHorizontal: 5, paddingVertical: 4, backgroundColor: '#102235CC', borderRadius: 18, borderWidth: 1, borderColor: '#EACB9135' },
  coin: { backgroundColor: '#FFFFFF0C', borderRadius: 15, paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  home: { padding: 16, paddingTop: 18, paddingBottom: 28, alignItems: 'stretch' },
  heroGlow: { width: 250, height: 250, borderRadius: 125, alignSelf: 'center', top: 5 },
  floatingIcon: { width: 220, height: 220, alignSelf: 'center', resizeMode: 'contain', marginBottom: -16 },
  heroCopy: { alignItems: 'center', marginTop: -3 },
  bigBtn: { minHeight: 60, marginTop: 12, marginBottom: 0, borderRadius: 21 },
  progressStrip: { marginTop: 13, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#1A3044E8', borderWidth: 1, borderColor: '#C8D7DE35', flexDirection: 'row', alignItems: 'center', shadowColor: '#000000', shadowOpacity: .32, shadowRadius: 10, elevation: 6 },
  progressIcon: { width: 38, height: 38, resizeMode: 'contain' },
  levelsMenuBtn: { width: '100%', minHeight: 64, borderRadius: 21, backgroundColor: '#DDE6EAF2', borderWidth: 1, borderColor: '#FFFFFF99', marginTop: 0 },
  levelsScreen: { backgroundColor: '#06111D35' },
  levelGrid: { paddingHorizontal: 10, paddingBottom: 32 },
  levelCardDone: { borderColor: '#EACB9190' },
  levelCardCurrent: { borderWidth: 2, borderColor: '#FFF0BA', shadowColor: '#EACB91', shadowOpacity: .55, shadowRadius: 13, elevation: 11 },
  levelCardLocked: { opacity: .45 },
  levelScene: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  levelSceneShade: { ...StyleSheet.absoluteFillObject, backgroundColor: '#07121F55' },
  levelNumberDone: { backgroundColor: '#9A7D43', borderColor: '#FFF0BA' },
  smallStarAsset: { width: 20, height: 20, resizeMode: 'contain' },
  gameTop: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#102235E8', borderBottomWidth: 1, borderBottomColor: '#EACB9140' },
  gameStatIcon: { width: 32, height: 32, resizeMode: 'contain' },
  gameBoardPanel: { marginHorizontal: 12, paddingHorizontal: 9, paddingTop: 9, paddingBottom: 13, borderRadius: 27, backgroundColor: '#142A3DEB', borderWidth: 1, borderColor: '#EACB9155', shadowColor: '#000000', shadowOpacity: .55, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 10, position: 'relative' },
  clue: { flexShrink: 0, backgroundColor: '#294156EE', borderRadius: 9, borderWidth: 1, borderColor: '#D8E3E82A', alignItems: 'center', justifyContent: 'center' },
  actionDock: { flexDirection: 'row', gap: 9, marginHorizontal: 12, marginTop: 10, padding: 7, borderRadius: 22, backgroundColor: '#142A3DEB', borderWidth: 1, borderColor: '#D8E3E82F' },
  modalBackdrop: { flex: 1, backgroundColor: '#04101ADB', padding: 18, alignItems: 'center', justifyContent: 'center' },
  modal: { width: '100%', maxWidth: 460, borderRadius: 32, borderWidth: 1, borderColor: '#EACB9170', backgroundColor: '#193044F7', padding: 22, alignItems: 'stretch', shadowColor: '#000000', shadowOpacity: .65, shadowRadius: 24, elevation: 16 },
  completionCrest: { width: 168, height: 168, resizeMode: 'contain', alignSelf: 'center', marginTop: -14, marginBottom: -14 },
  tileFloor: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%', resizeMode: 'stretch' },
  cell: { borderRadius: 12, backgroundColor: 'transparent', borderWidth: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cellLit: { backgroundColor: 'transparent' },
  cellLamp: { backgroundColor: 'transparent' },
  cellRock: { backgroundColor: '#101923', borderWidth: 1, borderColor: '#566B78' },
  tileAsset: { width: '80%', height: '80%', resizeMode: 'contain', zIndex: 4 },
  lightHalo: { position: 'absolute', width: '74%', height: '74%', borderRadius: 999, backgroundColor: '#FFE5A055', shadowColor: '#FFD67A', shadowOpacity: .85, shadowRadius: 16, zIndex: 2 },
  board: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#07131FCC', borderRadius: 21, padding: 0, overflow: 'hidden', flexShrink: 0, borderWidth: 0, shadowColor: '#EACB91', shadowOpacity: .22, shadowRadius: 15, elevation: 6 },
  tileAssetCompact: { width: '68%', height: '68%' },
  completionHero: { height: 205, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 16, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: '#EACB9155' },
  completionScene: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  completionSceneShade: { ...StyleSheet.absoluteFillObject, backgroundColor: '#07131F82' },
  completionSeal: { position: 'absolute', top: 2, width: 125, height: 125, resizeMode: 'contain' },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 2, marginTop: 8, marginBottom: 3 },
  bigStarAsset: { width: 58, height: 58, resizeMode: 'contain' },
  completionSummary: { marginHorizontal: 18, marginVertical: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#FFFFFF0B', borderWidth: 1, borderColor: '#D8E3E824' },
  summaryDivider: { width: 1, height: 31, backgroundColor: '#D8E3E82A' },
  rewards: { flexDirection: 'row', gap: 8, marginHorizontal: 18, marginTop: 4, marginBottom: 12 },
  reward: { flex: 1, minHeight: 61, backgroundColor: '#FFFFFF0B', padding: 8, borderRadius: 17, borderWidth: 1, borderColor: '#EACB9138', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  rewardIcon: { width: 43, height: 43, resizeMode: 'contain' },
  completionModal: { padding: 0, paddingBottom: 18, overflow: 'hidden', backgroundColor: '#172E42FA' },
  completionPrimary: { marginHorizontal: 18 },
  modalBtn: { marginTop: 8, marginHorizontal: 18 },
  transitionVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: '#EACB91', zIndex: 20 },
  completionParticles: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  completionParticle: { position: 'absolute', width: 12, height: 20, borderRadius: 8, backgroundColor: '#F8D98E', borderWidth: 1, borderColor: '#FFF4C9', shadowColor: '#FFD66E', shadowOpacity: .8, shadowRadius: 7, elevation: 5 },
  gameNav: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  gameTitle: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 2 },
  gameStats: { flexDirection: 'row', gap: 9, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 9 },
  gameStat: { flex: 1, minWidth: 0, height: 58, paddingHorizontal: 10, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1A3044E8', borderWidth: 1, borderColor: '#D4E0E638' },
  boardHeading: { minHeight: 62, marginHorizontal: 3, marginBottom: 9, paddingHorizontal: 7, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, borderBottomWidth: 1, borderBottomColor: '#FFFFFF14' },
  boardHeadingCopy: { flex: 1, minWidth: 0 },
  boardHeadingActions: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  boardHintButton: { minWidth: 84, minHeight: 46, borderRadius: 15, backgroundColor: '#EACB91', borderColor: '#FFF2C9' },
  rockBadge: { minWidth: 40, height: 40, paddingHorizontal: 4, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF0D', borderWidth: 1, borderColor: '#FFFFFF16' },
  rockBadgeIcon: { width: 26, height: 26, resizeMode: 'contain' },
  headerTitle: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  headerTitleText: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 19, lineHeight: 22, letterSpacing: .2, textAlign: 'center', textShadowColor: '#00000090', textShadowRadius: 5 },
  headerSubtitle: { color: '#AEBCC7', fontFamily: FONTS.body, fontSize: 9, lineHeight: 12, letterSpacing: .7, textAlign: 'center', marginTop: 1 },
  title: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 40, lineHeight: 46, fontWeight: '900', textAlign: 'center', letterSpacing: -1.1, textShadowColor: '#02070BCC', textShadowRadius: 11, textShadowOffset: { width: 0, height: 3 } },
  heading: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 23, lineHeight: 28, fontWeight: '900', letterSpacing: -.2, textShadowColor: '#00000099', textShadowRadius: 5 },
  bold: { color: '#F8F5ED', fontFamily: FONTS.strong, fontWeight: '800', textShadowColor: '#00000060', textShadowRadius: 2 },
  muted: { color: '#C5D0D7', fontFamily: FONTS.body },
  mutedCenter: { color: '#D4DDE2', fontFamily: FONTS.body, textAlign: 'center', fontSize: 15, lineHeight: 21, letterSpacing: .15, textShadowColor: '#02070BCC', textShadowRadius: 4 },
  homeEyebrow: { color: '#EACB91', fontFamily: FONTS.strong, textAlign: 'center', fontSize: 9, fontWeight: '900', letterSpacing: 2.8, marginBottom: 4 },
  heroChapter: { color: '#EACB91', fontFamily: FONTS.strong, fontSize: 10, fontWeight: '900', letterSpacing: 2.1, textTransform: 'uppercase' },
  heroLevel: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 26, lineHeight: 31, fontWeight: '900', marginTop: 2, letterSpacing: -.3 },
  btnText: { color: '#102235', fontFamily: FONTS.strong, fontSize: 14, fontWeight: '900', textAlign: 'center', flexShrink: 1, letterSpacing: .15 },
  progressValue: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 18, fontWeight: '900' },
  progressLabel: { color: '#BFCBD2', fontFamily: FONTS.body, fontSize: 9, letterSpacing: .5 },
  screenScroll: { flexGrow: 1, paddingBottom: 34 },
  screenIntro: { marginHorizontal: 13, marginTop: 13, paddingHorizontal: 16, paddingVertical: 15, minHeight: 128, borderRadius: 27, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#193247ED', borderWidth: 1, borderColor: '#EACB9148', shadowColor: '#000000', shadowOpacity: .4, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 8, overflow: 'hidden' },
  screenIntroIcon: { width: 88, height: 88, resizeMode: 'contain', flexShrink: 0 },
  screenIntroCopy: { flex: 1, minWidth: 0 },
  screenEyebrow: { color: '#EACB91', fontFamily: FONTS.strong, fontSize: 8, fontWeight: '900', letterSpacing: 1.7, marginBottom: 4 },
  screenIntroTitle: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 21, lineHeight: 25, fontWeight: '900', letterSpacing: -.2 },
  screenIntroBody: { color: '#B9C6CE', fontFamily: FONTS.body, fontSize: 11, lineHeight: 16, marginTop: 5 },
  sectionHeading: { marginHorizontal: 16, marginTop: 21, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionHeadingText: { color: '#D9E1E5', fontFamily: FONTS.strong, fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#EACB9135' },
  test: { color: '#D1BA86', fontFamily: FONTS.body, fontSize: 9, lineHeight: 13, textAlign: 'center', paddingHorizontal: 20, marginBottom: 2 },
  storeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 12, paddingTop: 8 },
  product: { width: '48%', minHeight: 244, borderRadius: 24, backgroundColor: '#193044ED', borderWidth: 1, borderColor: '#D8E3E838', padding: 13, justifyContent: 'space-between', alignItems: 'stretch', shadowColor: '#000000', shadowOpacity: .28, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  productImage: { width: 86, height: 86, alignSelf: 'center', resizeMode: 'contain' },
  productTitle: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 16, lineHeight: 20, fontWeight: '900', textAlign: 'center' },
  productDescription: { color: '#AEBCC7', fontFamily: FONTS.body, fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 4, minHeight: 28 },
  settingsCard: { marginHorizontal: 12, marginTop: 2, paddingHorizontal: 15, paddingTop: 4, paddingBottom: 16, borderRadius: 25, backgroundColor: '#193044ED', borderWidth: 1, borderColor: '#D8E3E838', shadowColor: '#000000', shadowOpacity: .3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  setting: { minHeight: 75, borderBottomWidth: 1, borderBottomColor: '#FFFFFF12', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  settingCopy: { flex: 1, minWidth: 0 },
  settingTitle: { color: '#F8F5ED', fontFamily: FONTS.strong, fontSize: 15, fontWeight: '800' },
  settingNote: { color: '#9FAFBA', fontFamily: FONTS.body, fontSize: 10, lineHeight: 14, marginTop: 2 },
  langRow: { flexDirection: 'row', gap: 5, flexShrink: 0 },
  tutorialBtn: { marginTop: 17, minHeight: 57, backgroundColor: '#E2EAEDF2' },
  layerTabIndex: { color: '#EACB91', fontFamily: FONTS.display, fontSize: 16, fontWeight: '900', lineHeight: 18 },
  layerTabText: { color: '#E5EAF0', fontFamily: FONTS.strong, fontSize: 9, fontWeight: '800', letterSpacing: .2, textAlign: 'center', maxWidth: '100%' },
  levelHeroTitle: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 21, lineHeight: 25, fontWeight: '900', letterSpacing: -.2 },
  levelHeroSubtitle: { color: '#BDC9D1', fontFamily: FONTS.body, fontSize: 10, lineHeight: 14, marginTop: 3, marginBottom: 9 },
  sectionLabel: { color: '#CAD4DA', fontFamily: FONTS.strong, fontSize: 9, fontWeight: '900', letterSpacing: 1.8, marginHorizontal: 16, marginBottom: 5 },
  nextRibbonText: { color: '#172536', fontFamily: FONTS.strong, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  gameLevelTitle: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 18, lineHeight: 21, fontWeight: '900', textAlign: 'center', letterSpacing: -.1 },
  gameLayerName: { color: '#AEBCC7', fontFamily: FONTS.body, fontSize: 9, fontWeight: '700', letterSpacing: .7, textAlign: 'center', marginTop: 1 },
  gameStatValue: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 16, lineHeight: 18, fontWeight: '900' },
  gameStatLabel: { color: '#AAB8C2', fontFamily: FONTS.strong, fontSize: 7, lineHeight: 10, fontWeight: '900', letterSpacing: 1 },
  boardKicker: { color: '#EACB91', fontFamily: FONTS.strong, fontSize: 7, lineHeight: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 1 },
  boardTitle: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 17, lineHeight: 20, fontWeight: '900', letterSpacing: -.15 },
  boardSubtitle: { color: '#AEBCC7', fontFamily: FONTS.body, fontSize: 9, lineHeight: 12, marginTop: 2 },
  lightProgressLabel: { color: '#AEBCC7', fontFamily: FONTS.strong, fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  lightProgressValue: { color: '#EACB91', fontFamily: FONTS.display, fontSize: 11, fontWeight: '900' },
  gameTip: { color: '#9FAFBA', fontFamily: FONTS.body, fontSize: 9, lineHeight: 13, textAlign: 'center', marginTop: 9, marginBottom: 5, letterSpacing: .2 },
  completionKicker: { color: '#EACB91', fontFamily: FONTS.strong, fontSize: 9, fontWeight: '900', letterSpacing: 2.2, textShadowColor: '#000000', textShadowRadius: 5 },
  completionTitle: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -.4, textShadowColor: '#000000', textShadowRadius: 7, marginTop: 2 },
  summaryLabel: { color: '#9FB0BC', fontFamily: FONTS.strong, fontSize: 7, fontWeight: '900', letterSpacing: 1.3, textAlign: 'center' },
  summaryValue: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: 2 },
  rewardLabel: { color: '#9FB0BC', fontFamily: FONTS.strong, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  rewardText: { color: '#F8F5ED', fontFamily: FONTS.display, fontWeight: '900', fontSize: 18 },
  solveFlash: { ...StyleSheet.absoluteFillObject, zIndex: 24, borderRadius: 27, backgroundColor: '#FFE6A0' },
  solveOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 30, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#071522D9', overflow: 'hidden' },
  solveRays: { position: 'absolute', width: 220, height: 220, alignItems: 'center', justifyContent: 'center', opacity: .55 },
  solveRay: { position: 'absolute', width: 2, height: 220, borderRadius: 2, backgroundColor: '#EACB9160' },
  solveSeal: { width: 132, height: 132, resizeMode: 'contain', marginBottom: -5 },
  solveKicker: { color: '#EACB91', fontFamily: FONTS.strong, fontSize: 8, fontWeight: '900', letterSpacing: 1.9, textAlign: 'center', textShadowColor: '#000000', textShadowRadius: 5 },
  solveTitle: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -.35, textAlign: 'center', textShadowColor: '#000000', textShadowRadius: 8, marginTop: 3 },
  gameBoardPanelCelebrating: { overflow: 'hidden' },
  solveBorderGlow: { ...StyleSheet.absoluteFillObject, zIndex: 21, borderRadius: 27, borderWidth: 3, borderColor: '#FFE7A5', backgroundColor: '#EACB910C', shadowColor: '#FFE29A', shadowOpacity: .9, shadowRadius: 18, elevation: 8 },
  solveSweep: { position: 'absolute', zIndex: 22, top: -70, bottom: -70, left: '42%', width: 72, borderRadius: 40, backgroundColor: '#FFF1B84A', shadowColor: '#FFE29A', shadowOpacity: .8, shadowRadius: 20, elevation: 9 },
  solveSpark: { position: 'absolute', zIndex: 23, width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: 4, backgroundColor: '#FFF2B8', shadowColor: '#FFD66E', shadowOpacity: .95, shadowRadius: 8, elevation: 10 },
  clueCelebrated: { backgroundColor: '#2F8B6A', borderColor: '#C8F4D8', shadowColor: '#8FE8B9', shadowOpacity: .8, shadowRadius: 7, elevation: 5 },
  clueCheck: { color: '#F2FFF7', fontFamily: FONTS.display, fontSize: 15, lineHeight: 18, textShadowColor: '#1B6249', textShadowRadius: 3 },
  clueCompletionCard: { marginHorizontal: 18, marginTop: 2, marginBottom: 5, minHeight: 62, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: '#173C34D9', borderWidth: 1, borderColor: '#76D0A75C' },
  clueCompletionItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  clueCompletionCheck: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#74C9AA', borderWidth: 1, borderColor: '#D8F8E8' },
  clueCompletionCheckText: { color: '#102E27', fontFamily: FONTS.display, fontSize: 17, lineHeight: 20, fontWeight: '900' },
  clueCompletionTitle: { color: '#F2FFF7', fontFamily: FONTS.strong, fontSize: 10, lineHeight: 13, fontWeight: '900' },
  clueCompletionValue: { color: '#9ED9C1', fontFamily: FONTS.body, fontSize: 8, lineHeight: 11, marginTop: 1 },
  clueCompletionDivider: { width: 1, height: 34, marginHorizontal: 6, backgroundColor: '#BCECD73A' },
  cellVoid: { backgroundColor: 'transparent', borderRadius: 12, opacity: 0 },
  completionClose: { position: 'absolute', zIndex: 60, right: 10, top: 10, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#102638E8', borderWidth: 1, borderColor: '#FFFFFF66', shadowColor: '#000000', shadowOpacity: .35, shadowRadius: 6, elevation: 12 },
  completionCloseText: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 27, lineHeight: 30, marginTop: -2 },
  mapHeader: { minHeight: 66, marginHorizontal: 10, marginTop: 9, marginBottom: 10, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 22, backgroundColor: '#102235ED', borderWidth: 1, borderColor: '#EACB9145', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, shadowColor: '#000000', shadowOpacity: .34, shadowRadius: 11, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  layerSelector: { marginBottom: 10 },
  layerSelectorLabel: { color: '#D2DDE3', fontFamily: FONTS.strong, fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 1.8, marginHorizontal: 16, marginBottom: 7 },
  layerTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 0, paddingBottom: 0 },
  layerTab: { width: 108, flexGrow: 0, flexShrink: 0, height: 52, paddingHorizontal: 7, borderRadius: 17, borderWidth: 1, borderColor: '#C8D7DE35', backgroundColor: '#1A3044E8', alignItems: 'center', justifyContent: 'center' },
  heroPanel: { minHeight: 365, marginTop: 10, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, alignItems: 'stretch', justifyContent: 'flex-end', overflow: 'visible', backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  storeSection: { marginTop: 7, marginBottom: 5 },
  storeSectionIcon: { width: 30, height: 30, resizeMode: 'contain' },
  storePackageRow: { gap: 10, paddingHorizontal: 12, paddingTop: 7, paddingBottom: 13 },
  storePackage: { width: 158, minHeight: 270, paddingHorizontal: 12, paddingTop: 15, paddingBottom: 12, borderRadius: 24, backgroundColor: '#193044F2', borderWidth: 1, borderColor: '#D8E3E83D', alignItems: 'stretch', shadowColor: '#000000', shadowOpacity: .32, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6, overflow: 'hidden' },
  storePackageFeatured: { borderColor: '#EACB91B5', backgroundColor: '#213A4FF7', shadowColor: '#EACB91', shadowOpacity: .3, shadowRadius: 12, elevation: 9 },
  popularBadge: { position: 'absolute', left: 0, right: 0, top: 0, height: 24, backgroundColor: '#EACB91', alignItems: 'center', justifyContent: 'center' },
  popularBadgeText: { color: '#102235', fontFamily: FONTS.strong, fontSize: 7, fontWeight: '900', letterSpacing: 1.1 },
  packageTier: { minHeight: 19, marginTop: 11, color: '#C4D0D7', fontFamily: FONTS.strong, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center', textTransform: 'uppercase' },
  packageImage: { width: 68, height: 68, marginTop: 1, alignSelf: 'center', resizeMode: 'contain' },
  packageAmount: { color: '#F8F5ED', fontFamily: FONTS.display, fontSize: 30, lineHeight: 34, fontWeight: '900', textAlign: 'center', letterSpacing: -.4 },
  packageUnit: { color: '#EACB91', fontFamily: FONTS.strong, fontSize: 10, fontWeight: '900', textAlign: 'center', letterSpacing: .8, textTransform: 'uppercase' },
  packageDescription: { flex: 1, minHeight: 34, marginTop: 6, color: '#AEBCC7', fontFamily: FONTS.body, fontSize: 9, lineHeight: 13, textAlign: 'center' },
  packageBuyButton: { minHeight: 46, marginTop: 8, borderRadius: 16 },
  storeUtilityCard: { marginHorizontal: 12, marginTop: 12, padding: 12, minHeight: 92, borderRadius: 23, backgroundColor: '#193044F2', borderWidth: 1, borderColor: '#EACB9150', flexDirection: 'row', alignItems: 'center', gap: 10 },
  storeUtilityIcon: { width: 60, height: 60, resizeMode: 'contain', flexShrink: 0 },
  storeUtilityCopy: { flex: 1, minWidth: 0 },
  storeUtilityButton: { minWidth: 112, flexShrink: 0 },
  restoreButton: { marginHorizontal: 12, marginTop: 10, marginBottom: 7, minHeight: 54 },
  brandFooter: { marginTop: 22, marginBottom: 2, alignItems: 'center', justifyContent: 'center' },
  brandLogoFrame: { width: 58, height: 58, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: '#EACB9155', backgroundColor: '#102235', shadowColor: '#000000', shadowOpacity: .3, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  brandLogo: { width: '100%', height: '100%', resizeMode: 'cover' },
  brandName: { marginTop: 7, color: '#B9C6CE', fontFamily: FONTS.strong, fontSize: 8, fontWeight: '900', letterSpacing: 2.1 },
  placementGlow: { position: 'absolute', zIndex: 2, width: '78%', height: '78%', borderRadius: 999, backgroundColor: '#FFE8A8B8', shadowColor: '#FFF0B8', shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  placementRing: { position: 'absolute', zIndex: 3, width: '78%', height: '78%', borderRadius: 999, borderWidth: 2, borderColor: '#FFF5C7', backgroundColor: 'transparent', shadowColor: '#FFD66E', shadowOpacity: .9, shadowRadius: 7, elevation: 3 },
  placementRingOuter: { position: 'absolute', zIndex: 3, width: '64%', height: '64%', borderRadius: 999, borderWidth: 1, borderColor: '#EACB91B8', backgroundColor: 'transparent' },
  removalGlow: { position: 'absolute', zIndex: 3, width: '72%', height: '72%', borderRadius: 999, backgroundColor: '#B8E7E199', shadowColor: '#B8E7E1', shadowOpacity: .8, shadowRadius: 8, elevation: 3 },
  removalRing: { position: 'absolute', zIndex: 3, width: '72%', height: '72%', borderRadius: 999, borderWidth: 2, borderStyle: 'dashed', borderColor: '#D5F4ED', backgroundColor: 'transparent' },
  levelHeroCard: { marginHorizontal: 12, marginBottom: 12, minHeight: 82, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, backgroundColor: '#172D40F2', borderWidth: 1, borderColor: '#EACB9148', flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000000', shadowOpacity: .34, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  levelHeroIconFrame: { width: 56, height: 56, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A1B2CCC', overflow: 'hidden' },
  levelHeroMoon: { color: '#F7E4AE', fontFamily: FONTS.display, fontSize: 34, lineHeight: 39, textAlign: 'center', textShadowColor: '#EACB9170', textShadowRadius: 8 },
  levelCard: { width: '31.5%', aspectRatio: 1.16, marginVertical: 4, borderRadius: 16, backgroundColor: '#14283AF7', borderWidth: 1, borderColor: '#D8E3E83D', alignItems: 'stretch', justifyContent: 'center', overflow: 'hidden', shadowColor: '#000000', shadowOpacity: .24, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  levelCardColor: { ...StyleSheet.absoluteFillObject, opacity: .12 },
  levelCardInnerBorder: { ...StyleSheet.absoluteFillObject, margin: 4, borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF12' },
  levelCardTop: { flex: 1, minHeight: 0, paddingHorizontal: 5, paddingTop: 14, paddingBottom: 5, backgroundColor: 'transparent', borderTopWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  levelNumberCircle: { position: 'relative', top: 0, left: 0, width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C2031E8', borderWidth: 1, borderColor: '#F3E3B76B', marginBottom: 0 },
  levelCardNumber: { color: '#F8F3E7', fontFamily: FONTS.display, fontSize: 17, lineHeight: 20 },
  nextRibbon: { position: 'absolute', zIndex: 3, top: 7, left: 7, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: '#E7C56B' },
  completedLabel: { position: 'absolute', zIndex: 3, top: 7, right: 7, color: '#B8E9D5', fontFamily: FONTS.strong, fontSize: 7, letterSpacing: .5 },
  textStarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  textStar: { fontFamily: FONTS.strong, fontSize: 12, lineHeight: 15 },
  textStarEarned: { color: '#F3D27D', textShadowColor: '#EACB9170', textShadowRadius: 4 },
  textStarEmpty: { color: '#728397' },
  tutorialHeader: { marginHorizontal: 4, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 13 },
  tutorialHeaderIcon: { width: 68, height: 68, resizeMode: 'contain' },
  tutorialHeaderCopy: { flex: 1 },
  tutorialStep: { marginBottom: 3, color: '#EACB91', fontFamily: FONTS.strong, fontSize: 10, letterSpacing: 1.5 },
  tutorialDescription: { marginTop: 5, color: '#C1CDD6', fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },
  tutorialBoardCard: { alignSelf: 'center', padding: 14, paddingBottom: 12, borderRadius: 24, backgroundColor: '#13283BF2', borderWidth: 1, borderColor: '#EACB9148', shadowColor: '#000000', shadowOpacity: .35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  tutorialTopTargets: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  tutorialBoardRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  tutorialCorner: { width: 54, height: 34 },
  tutorialClue: { width: 54, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#293F53', borderWidth: 1, borderColor: '#FFFFFF18' },
  tutorialClueDone: { backgroundColor: '#28604F', borderColor: '#91E1BF' },
  tutorialClueText: { color: '#F8F5ED', fontFamily: FONTS.strong, fontSize: 15 },
  tutorialCell: { width: 54, height: 54, borderRadius: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#344B5E', borderWidth: 1, borderColor: '#FFFFFF16' },
  tutorialCellLit: { backgroundColor: '#786B43', borderColor: '#EACB9160' },
  tutorialCellGuide: { borderWidth: 2, borderColor: '#F2D47C' },
  tutorialCellLantern: { width: 48, height: 48, resizeMode: 'contain' },
  tutorialSpark: { color: '#FFF0B0', fontSize: 27, lineHeight: 29 },
  tutorialStatus: { marginTop: 7, color: '#EACB91', fontFamily: FONTS.strong, fontSize: 11, textAlign: 'center' },
  tutorialStatusDone: { color: '#91E1BF' },
  tutorialContinue: { minHeight: 56, marginTop: 20 },
  storeComingSoon: { marginHorizontal: 12, marginTop: 5, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 18, backgroundColor: '#EACB9118', borderWidth: 1, borderColor: '#EACB9160', alignItems: 'center' },
  storeComingSoonTitle: { color: '#F3D27D', fontFamily: FONTS.display, fontSize: 16, letterSpacing: 2 },
  storeComingSoonText: { marginTop: 4, color: '#C7D2D9', fontFamily: FONTS.body, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  layerTabSelected: { borderWidth: 2, borderColor: '#F8E4A6', shadowColor: '#EACB91', shadowOpacity: .55, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 7 },
  layerTabSelectedText: { color: '#091827', fontFamily: FONTS.strong, fontWeight: '900' },
  layerSelectedMark: { position: 'absolute', left: 18, right: 18, bottom: 4, height: 3, borderRadius: 2, backgroundColor: '#FFF0B8' },
  gameHeaderActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, flexShrink: 0 }
});
