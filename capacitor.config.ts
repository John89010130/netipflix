import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.net.netipflix',
  appName: 'NETIPFLIX',
  webDir: 'dist',
  server: {
    // Carregar do servidor remoto - mudanças no site refletem automaticamente!
    url: 'https://john89010130.github.io/netipflix/',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    // Configurações de fullscreen
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
