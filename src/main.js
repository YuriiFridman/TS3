const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');

let mainWindow;
let tcpClient = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: false,
    backgroundColor: '#1a1a1a',
    show: false
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    if (tcpClient) {
      tcpClient.destroy();
      tcpClient = null;
    }
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC обработчики
ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});

// TCP соединение с Python сервером (ИСПРАВЛЕНО)
ipcMain.handle('connect-to-server', async (event, { host, port }) => {
  return new Promise((resolve, reject) => {
    if (tcpClient) {
      tcpClient.destroy();
      tcpClient = null;
    }

    tcpClient = new net.Socket();

    // ИСПРАВЛЕНИЕ: используем 127.0.0.1 вместо localhost
    const connectHost = host === 'localhost' ? '127.0.0.1' : host;

    tcpClient.connect(port, connectHost, () => {
      console.log('✅ Подключено к серверу:', connectHost + ':' + port);
      mainWindow.webContents.send('server-connected');
      resolve();
    });

    tcpClient.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString().trim());
        console.log('📨 Получено от сервера:', message);
        mainWindow.webContents.send('server-message', message);
      } catch (error) {
        console.error('❌ Ошибка парсинга:', error);
      }
    });

    tcpClient.on('error', (error) => {
      console.error('❌ Ошибка TCP:', error);
      mainWindow.webContents.send('server-error', error.message);
      reject(error);
    });

    tcpClient.on('close', () => {
      console.log('🔌 TCP соединение закрыто');
      mainWindow.webContents.send('server-disconnected');
      tcpClient = null;
    });
  });
});

ipcMain.handle('send-to-server', (event, message) => {
  if (tcpClient && tcpClient.writable) {
    const data = JSON.stringify(message);
    console.log('📤 Отправка на сервер:', data);
    tcpClient.write(data);
  } else {
    console.error('❌ TCP клиент не готов');
  }
});

ipcMain.handle('disconnect-from-server', () => {
  if (tcpClient) {
    tcpClient.destroy();
    tcpClient = null;
  }
});