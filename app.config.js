const IS_IOS = process.env.EAS_BUILD_PLATFORM === 'ios';

module.exports = {
  expo: {
    name: 'Steward',
    slug: 'steward',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'stewardapp',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#1a0505',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.steward.app',
      usesAppleSignIn: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#1a0505',
      },
      package: 'com.steward.app',
      minSdkVersion: 24,
      compileSdkVersion: 35,
      targetSdkVersion: 35,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      // Apple Sign-In — iOS only, skip on Android to avoid Gradle errors
      ...(IS_IOS ? ['expo-apple-authentication'] : []),
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#4E0B0B',
          sounds: [],
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'd7675e2d-529c-4920-9630-8a50f15cb045',
      },
    },
    owner: 'akiuss-organization',
  },
};
