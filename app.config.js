const TEST_APP_IDS = {
  ios: 'ca-app-pub-3940256099942544~1458002511',
  android: 'ca-app-pub-3940256099942544~3347511713'
};

module.exports = ({ config }) => ({
  ...config,
  plugins: (config.plugins || []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== 'react-native-google-mobile-ads') return plugin;
    return [
      plugin[0],
      {
        ...plugin[1],
        iosAppId: process.env.ADMOB_IOS_APP_ID || TEST_APP_IDS.ios,
        androidAppId: process.env.ADMOB_ANDROID_APP_ID || TEST_APP_IDS.android
      }
    ];
  })
});
