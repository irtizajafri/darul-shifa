import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Every build gets its own id (owner, 2026-10-30): it's baked into the app
// and written to dist/version.json. Open PCs poll that file and show the
// "System Updated" alert (src/components/system/UpdateNotice.jsx) when the server
// has a newer build than the one they're running.
const BUILD_ID = Date.now().toString(36)

function buildVersionFile() {
  return {
    name: 'build-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId: BUILD_ID }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), buildVersionFile()],
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
  },
})
