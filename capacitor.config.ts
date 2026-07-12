import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

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
  plugins: {
    Keyboard: {
      // Don't resize the webview when the keyboard appears — the reflow caused a
      // visible jump/relayout on every form. With `none` the keyboard overlays
      // the webview and WKWebView scrolls the focused field into view, so the
      // layout stays put and the transition is smooth.
      resize: KeyboardResize.None,
    },
  },
};

export default config;
