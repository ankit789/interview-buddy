// Minimal Excalidraw type shims — avoids deep package path resolution issues
export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: { text?: string };
  [key: string]: unknown;
}

export interface AppState {
  viewBackgroundColor: string;
  [key: string]: unknown;
}
