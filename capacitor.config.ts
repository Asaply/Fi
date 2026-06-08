import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'lat.nva.app',
  appName: 'NVA',
  webDir: 'out',
  server: {
    allowNavigation: ['nva.lat', '*.nva.lat'],
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#000000',
  },
};

export default config;
