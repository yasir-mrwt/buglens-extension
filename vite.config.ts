import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const staticExtensionEntries = [
  'manifest.json',
  'assets/icons',
  'popup/popup.html',
  'popup/popup.css',
  'devtools/devtools.html',
  'devtools/panel.html',
  'devtools/panel.css',
  'docs'
];

function copyStaticExtensionFiles(): Plugin {
  return {
    name: 'testpilot-copy-static-extension-files',
    apply: 'build',
    async closeBundle() {
      const outDir = resolve(__dirname, 'dist');
      await mkdir(outDir, { recursive: true });

      await Promise.all(staticExtensionEntries.map(async (entry) => {
        const destination = resolve(outDir, entry);
        await mkdir(dirname(destination), { recursive: true });
        await cp(resolve(__dirname, entry), destination, {
          recursive: true,
          force: true
        });
      }));

      const panelHtmlPath = resolve(outDir, 'devtools/panel.html');
      const panelHtml = await readFile(panelHtmlPath, 'utf8');
      const updatedPanelHtml = panelHtml.replace(
        /<body data-active-view="ai">[\s\S]*?<\/body>/,
        `<body data-active-view="ai">
    <div id="testpilotReactRoot"></div>
    <script type="module" src="../assets/devtools-panel.js"></script>
    <script type="module" src="panel.js"></script>
  </body>`
      );
      await writeFile(panelHtmlPath, updatedPanelHtml);

      const generatedEntries = [
        'background/service-worker.js',
        'content/content-script.js',
        'content/injected-console-listener.js',
        'content/injected-network-listener.js',
        'devtools/devtools.js',
        'devtools/panel.js',
        'popup/popup.js',
        'assets/client.js',
        'assets/devtools-panel.js',
        'assets/messages.js'
      ];

      await Promise.all(generatedEntries.map(async (entry) => {
        const source = resolve(outDir, entry);
        const destination = resolve(__dirname, entry);
        await mkdir(dirname(destination), { recursive: true });
        await cp(source, destination, { force: true });
      }));
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    copyStaticExtensionFiles()
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'content/content-script': resolve(__dirname, 'src/content/content-script.ts'),
        'content/injected-console-listener': resolve(__dirname, 'src/content/injected-console-listener.ts'),
        'content/injected-network-listener': resolve(__dirname, 'src/content/injected-network-listener.ts'),
        'devtools/devtools': resolve(__dirname, 'src/devtools/devtools.ts'),
        'devtools/panel': resolve(__dirname, 'src/devtools/panel/panelController.ts'),
        'popup/popup': resolve(__dirname, 'src/popup/main.tsx'),
        'devtools-panel': resolve(__dirname, 'src/devtools/panel/main.tsx')
      },
      output: {
        entryFileNames: (chunkInfo) => (
          chunkInfo.name.includes('/')
            ? '[name].js'
            : 'assets/[name].js'
        ),
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
});
