import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.otsmane.keonote',
  appName: 'Keo Note',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
};

export default config;
