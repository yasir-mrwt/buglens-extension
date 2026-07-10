export type TestPilotSettings = {
  slowApiMs: number;
  verySlowApiMs: number;
  duplicateWindowMs: number;
  maxBodyPreviewBytes: number;
  maxApiIssues: number;
  maxConsoleIssues: number;
  maxUiIssues: number;
  maxUiNodes: number;
  maxIssuesPerRule: number;
  captureResponseBody: boolean;
  hideFrameworkNoise: boolean;
  showNextPrefetchFindings: boolean;
  treatFrameworkPrefetchAsIssue: boolean;
  uiVisibleViewportOnly: boolean;
  uiIncludeDecorativeElements: boolean;
  exportFrameworkNoise: boolean;
  csvExportEnabled: boolean;
  allowedColors: string[];
};

export const DEFAULT_SETTINGS: TestPilotSettings = {
  slowApiMs: 1000,
  verySlowApiMs: 3000,
  duplicateWindowMs: 2000,
  maxBodyPreviewBytes: 10000,
  maxApiIssues: 500,
  maxConsoleIssues: 300,
  maxUiIssues: 200,
  maxUiNodes: 4000,
  maxIssuesPerRule: 25,
  captureResponseBody: false,
  hideFrameworkNoise: true,
  showNextPrefetchFindings: false,
  treatFrameworkPrefetchAsIssue: false,
  uiVisibleViewportOnly: true,
  uiIncludeDecorativeElements: false,
  exportFrameworkNoise: true,
  csvExportEnabled: true,
  allowedColors: []
};

export function mergeSettings(value: Partial<TestPilotSettings> | undefined): TestPilotSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(value || {})
  };
}
