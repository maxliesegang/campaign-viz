import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]

  return {
    // Use repo subpath on GitHub Pages; keep root base for local dev/preview
    base: mode === 'production' && repoName ? `/${repoName}/` : '/',
    plugins: [tailwindcss()],
  }
})
