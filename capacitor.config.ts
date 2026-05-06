import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.integraweb.fnce',
  appName: 'FNCE',
  webDir: 'out',
  server: {
    url: 'https://finanzas-integraweb.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#09090b',
  },
};

export default config;
