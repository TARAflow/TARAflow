// ==================== ELECTRON OAUTH HANDLER ====================
// Electron main process handler for OAuth deep links
// Place this code in your electron/main.ts or electron/main.cjs

/**
 * Setup OAuth deep link handling in Electron main process
 * 
 * Add this to your main.ts after app.whenReady()
 */

import { app, BrowserWindow } from 'electron';

// ==================== DEEP LINK PROTOCOL ====================

const OAUTH_PROTOCOL = 'taraflow';

/**
 * Register custom protocol handler for OAuth callbacks
 * Must be called before app is ready
 */
export function registerOAuthProtocol() {
  // Set as default protocol client
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(OAUTH_PROTOCOL, process.execPath, [
        process.argv[1],
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(OAUTH_PROTOCOL);
  }
}

/**
 * Handle OAuth callback URLs
 * Call this in your main process setup
 */
export function setupOAuthHandler(mainWindow: BrowserWindow | null) {
  // Handle deep links on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleOAuthCallback(url, mainWindow);
  });

  // Handle deep links on Windows/Linux
  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine) => {
      // Someone tried to run a second instance, we should focus our window
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }

      // Check for OAuth callback in command line
      const url = commandLine.find((arg) => arg.startsWith(`${OAUTH_PROTOCOL}://`));
      if (url) {
        handleOAuthCallback(url, mainWindow);
      }
    });
  }
}

/**
 * Parse OAuth callback URL and send to renderer
 */
function handleOAuthCallback(url: string, mainWindow: BrowserWindow | null) {
  if (!mainWindow) {
    console.error('No main window available for OAuth callback');
    return;
  }

  try {
    const parsedUrl = new URL(url);
    
    // Check if this is an auth callback
    if (parsedUrl.pathname === '/auth/callback') {
      const code = parsedUrl.searchParams.get('code');
      const state = parsedUrl.searchParams.get('state');
      const error = parsedUrl.searchParams.get('error');
      const errorDescription = parsedUrl.searchParams.get('error_description');

      // Send to renderer process
      mainWindow.webContents.send('oauth-callback', {
        code,
        state,
        error,
        errorDescription,
      });

      // Focus and show the window
      mainWindow.show();
      mainWindow.focus();
    }
  } catch (error) {
    console.error('Failed to parse OAuth callback URL:', error);
  }
}

// ==================== EXAMPLE USAGE IN MAIN.TS ====================

/*
// In your electron/main.ts:

import { app, BrowserWindow } from 'electron';
import { registerOAuthProtocol, setupOAuthHandler } from './oauth-handler';

let mainWindow: BrowserWindow | null = null;

// Register protocol before app is ready
registerOAuthProtocol();

app.whenReady().then(() => {
  mainWindow = createWindow(); // Your window creation function
  
  // Setup OAuth callback handler
  setupOAuthHandler(mainWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
*/

// ==================== IPC HANDLERS ====================

/**
 * Optional: Add IPC handlers for OAuth operations
 * Add these to your preload.ts and main.ts
 */

/*
// In preload.ts:

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // ... existing APIs ...
  
  oauth: {
    onCallback: (callback: (data: any) => void) => {
      ipcRenderer.on('oauth-callback', (_, data) => callback(data));
    },
    removeCallback: () => {
      ipcRenderer.removeAllListeners('oauth-callback');
    },
  },
});

// TypeScript declaration:
declare global {
  interface Window {
    electron: {
      oauth: {
        onCallback: (callback: (data: OAuthCallbackData) => void) => void;
        removeCallback: () => void;
      };
    };
  }
}

interface OAuthCallbackData {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}
*/