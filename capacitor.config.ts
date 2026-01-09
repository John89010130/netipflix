import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.net.netipflix',
  appName: 'NETIPFLIX',
  webDir: 'dist',
  server: {
    // Carregar localmente via HTTP (permite streams HTTP diretos)
    androidScheme: 'http',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#000000'
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000'
    }
  }
};

export default config;
