import { Platform } from 'react-native';
import { PRODUCTS, shouldShowInterstitial } from './config';
export { shouldShowInterstitial };

const IOS_AD_UNITS = {
  interstitial: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID,
  rewarded: process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID
};

let adsSdk;
let initializePromise;
let privacyOptionsRequired = false;
const slots = {
  interstitial: { ad: null, loading: null },
  rewarded: { ad: null, loading: null }
};

function getAdsSdk() {
  if (adsSdk !== undefined) return adsSdk;
  try {
    // Expo Go bu yerel modülü içermez. Paketi require etmek bile TurboModule
    // hatası ürettiğinden, Expo Go ortamını önce güvenli biçimde ayırıyoruz.
    const Constants = require('expo-constants').default;
    if (Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo') {
      adsSdk = null;
      return adsSdk;
    }
    adsSdk = require('react-native-google-mobile-ads');
  } catch (error) {
    adsSdk = null;
  }
  return adsSdk;
}

function unitId(kind, sdk) {
  if (__DEV__ || Platform.OS !== 'ios') {
    return kind === 'rewarded' ? sdk.TestIds.REWARDED : sdk.TestIds.INTERSTITIAL;
  }
  return IOS_AD_UNITS[kind] || (kind === 'rewarded' ? sdk.TestIds.REWARDED : sdk.TestIds.INTERSTITIAL);
}

async function initializeAds() {
  const sdk = getAdsSdk();
  if (!sdk) return false;
  if (!initializePromise) {
    initializePromise = (async () => {
      let canRequestAds = false;
      try {
        const consent = await sdk.AdsConsent.gatherConsent();
        canRequestAds = Boolean(consent?.canRequestAds);
        privacyOptionsRequired = consent?.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
        if (!canRequestAds) {
          const current = await sdk.AdsConsent.getConsentInfo();
          canRequestAds = Boolean(current?.canRequestAds);
          privacyOptionsRequired = current?.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
        }
      } catch {
        try {
          const current = await sdk.AdsConsent.getConsentInfo();
          canRequestAds = Boolean(current?.canRequestAds);
          privacyOptionsRequired = current?.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
        } catch {}
      }
      if (!canRequestAds) return false;
      await sdk.default().initialize();
      return true;
    })()
      .then((initialized) => {
        if (!initialized) return false;
        preload('interstitial');
        preload('rewarded');
        return true;
      })
      .catch(() => false);
  }
  return initializePromise;
}

function preload(kind) {
  const sdk = getAdsSdk();
  const slot = slots[kind];
  if (!sdk || slot.ad) return Promise.resolve(Boolean(slot.ad));
  if (slot.loading) return slot.loading;

  const AdClass = kind === 'rewarded' ? sdk.RewardedAd : sdk.InterstitialAd;
  const loadedEvent = kind === 'rewarded' ? sdk.RewardedAdEventType.LOADED : sdk.AdEventType.LOADED;
  const ad = AdClass.createForAdRequest(unitId(kind, sdk), {
    requestNonPersonalizedAdsOnly: true
  });

  slot.loading = new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      removeLoaded();
      removeError();
      slot.loading = null;
    };
    const finish = (success) => {
      if (settled) return;
      settled = true;
      if (success) slot.ad = ad;
      cleanup();
      resolve(success);
    };
    const removeLoaded = ad.addAdEventListener(loadedEvent, () => finish(true));
    const removeError = ad.addAdEventListener(sdk.AdEventType.ERROR, () => finish(false));
    ad.load();
  });

  return slot.loading;
}

function waitForLoad(kind, timeoutMs = 3500) {
  return Promise.race([
    preload(kind),
    new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs))
  ]);
}

async function showInterstitial() {
  const sdk = getAdsSdk();
  if (!sdk || !(await initializeAds())) return { shown: false, unavailable: true };
  if (!slots.interstitial.ad) await waitForLoad('interstitial');
  const ad = slots.interstitial.ad;
  if (!ad) return { shown: false, unavailable: true };
  slots.interstitial.ad = null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (shown) => {
      if (settled) return;
      settled = true;
      removeClosed();
      removeError();
      preload('interstitial');
      resolve({ shown });
    };
    const removeClosed = ad.addAdEventListener(sdk.AdEventType.CLOSED, () => finish(true));
    const removeError = ad.addAdEventListener(sdk.AdEventType.ERROR, () => finish(false));
    ad.show().catch(() => finish(false));
  });
}

async function showRewarded() {
  const sdk = getAdsSdk();
  if (!sdk || !(await initializeAds())) return { earned: false, unavailable: true };
  if (!slots.rewarded.ad) await waitForLoad('rewarded', 6000);
  const ad = slots.rewarded.ad;
  if (!ad) return { earned: false, unavailable: true };
  slots.rewarded.ad = null;

  return new Promise((resolve) => {
    let earned = false;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      removeEarned();
      removeClosed();
      removeError();
      preload('rewarded');
      resolve({ earned });
    };
    const removeEarned = ad.addAdEventListener(sdk.RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
    const removeClosed = ad.addAdEventListener(sdk.AdEventType.CLOSED, finish);
    const removeError = ad.addAdEventListener(sdk.AdEventType.ERROR, finish);
    ad.show().catch(finish);
  });
}

export const nativeServices = {
  mode: 'native-ads',
  productIds: PRODUCTS[Platform.OS] || PRODUCTS.android,
  initialize: initializeAds,
  showRewarded,
  showInterstitial,
  isPrivacyOptionsRequired() { return privacyOptionsRequired; },
  async showPrivacyOptions() {
    const sdk = getAdsSdk();
    if (!sdk) return false;
    try {
      const info = await sdk.AdsConsent.showPrivacyOptionsForm();
      privacyOptionsRequired = info?.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
      return true;
    } catch { return false; }
  },
  async purchase(productId) { return { success: true, productId, testMode: true }; },
  async restore() { return { restored: false, testMode: true }; }
};
