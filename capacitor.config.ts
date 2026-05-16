import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'lat.nva.app',
  appName: 'NVA',
  webDir: 'out',
  server: {
    url: 'https://finanzas-integraweb.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#000000',
  },
};

export default config;
