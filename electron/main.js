const { app, BrowserWindow, session } = require('electron');
const path = require('path');

// Desabilitar segurança para permitir HTTP
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-running-insecure-content');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Permite HTTP de qualquer origem
    },
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    title: 'NETIPFLIX'
  });

  // Permitir mixed content (HTTPS + HTTP)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob:"]
      }
    });
  });

  // Carregar o app
  if (process.env.ELECTRON_DEV === 'true') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Fullscreen com F11
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
    }
  });

  // Marcar como app Electron para o VideoPlayer
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      window.isElectronApp = true;
      window.Capacitor = { isNativePlatform: () => true };
      console.log('🖥️ Electron App - HTTP direto habilitado');
    `);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
