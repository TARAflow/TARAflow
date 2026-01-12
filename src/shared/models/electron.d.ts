export interface OAuthCallbackData {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

declare global {
  interface Window {
    electron?: {
      shell: {
        openExternal: (url: string) => Promise<void>;
      };
      oauth?: {
        onCallback: (callback: (data: OAuthCallbackData) => void) => void;
        removeCallback: () => void;
      };
    };
  }
}