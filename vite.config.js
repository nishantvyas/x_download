import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs-extra';

// Helper function to copy extension files
async function copyExtensionFiles() {
  // Create dist directory if it doesn't exist
  await fs.ensureDir('dist');

  // Copy manifest and icons
  await fs.copy('manifest.json', 'dist/manifest.json');
  await fs.copy('public/icon16.png', 'dist/icon16.png');
  await fs.copy('public/icon32.png', 'dist/icon32.png');
  await fs.copy('public/icon48.png', 'dist/icon48.png');
  await fs.copy('public/icon128.png', 'dist/icon128.png');
  
  // Copy popup HTML
  await fs.copy('src/popup/index.html', 'dist/popup.html');
}

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  if (mode === 'content') {
    return {
      plugins: [
        {
          name: 'copy-files',
          async buildStart() {
            await copyExtensionFiles();
          }
        }
      ],
      build: {
        outDir: 'dist',
        minify: false,
        sourcemap: true,
        lib: {
          entry: resolve(__dirname, 'src/content/index.js'),
          formats: ['iife'],
          name: 'LinkedInCommentAI',
          fileName: () => 'content.js'
        },
        emptyOutDir: false
      }
    };
  }

  if (mode === 'background') {
    return {
      build: {
        outDir: 'dist',
        lib: {
          entry: resolve(__dirname, 'src/background/index.js'),
          formats: ['iife'],
          name: 'LinkedInCommentAIBackground',
          fileName: () => 'background.js'
        },
        emptyOutDir: false
      }
    };
  }

  if (mode === 'popup') {
    return {
      build: {
        outDir: 'dist',
        lib: {
          entry: resolve(__dirname, 'src/popup/index.js'),
          formats: ['iife'],
          name: 'LinkedInCommentAIPopup',
          fileName: () => 'popup.js'
        },
        emptyOutDir: false
      }
    };
  }

  // Default build mode - copy files and create empty build
  return {
    plugins: [
      {
        name: 'copy-files',
        async buildStart() {
          await copyExtensionFiles();
        }
      }
    ],
    build: {
      outDir: 'dist',
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        formats: ['es'],
        fileName: () => 'empty'
      },
      emptyOutDir: true
    }
  };
}); 