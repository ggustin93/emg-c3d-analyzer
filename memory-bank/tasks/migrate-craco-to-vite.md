# Task: Migrate from CRACO to Vite

## Overview
Migrate the frontend from Create React App with CRACO configuration to Vite for improved development experience and build performance.

## Benefits
- **Much faster dev server** - Hot reloading is significantly faster
- **Faster builds** - Vite uses esbuild which is much faster than webpack
- **Better TypeScript support** - Native TypeScript support without additional configuration
- **Modern tooling** - More active development and better ecosystem
- **Smaller bundle sizes** - Better tree shaking and optimization

## Current State Analysis
- Using `@craco/craco: ^7.1.0`
- CRACO config only sets up path alias: `'@': path.resolve(__dirname, 'src/')`
- Standard Create React App structure
- TypeScript configuration present
- Using React 19.1.0

## Migration Plan

### Phase 1: Dependencies and Configuration
- [ ] Remove CRA and CRACO dependencies
  ```bash
  npm uninstall react-scripts @craco/craco
  ```

- [ ] Install Vite and React plugin
  ```bash
  npm install --save-dev vite @vitejs/plugin-react
  ```

- [ ] Create `vite.config.ts` with React plugin and path alias
  ```ts
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'
  import path from 'path'

  export default defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    }
  })
  ```

### Phase 2: Project Structure Updates
- [ ] Move `public/index.html` to root if needed
- [ ] Update `index.html` to remove %PUBLIC_URL% references
- [ ] Ensure `index.html` has correct script tag: `<script type="module" src="/src/main.tsx"></script>`

### Phase 3: Package.json Updates
- [ ] Update scripts in `package.json`:
  ```json
  {
    "scripts": {
      "start": "vite",
      "build": "vite build",
      "preview": "vite preview",
      "test": "jest"
    }
  }
  ```

### Phase 4: Environment Variables
- [ ] Rename environment variables from `REACT_APP_*` to `VITE_*`
- [ ] Update any references to these variables in the code
- [ ] Current variables to check:
  - Supabase URL and keys (if using env vars)
  - Any other API endpoints

### Phase 5: Asset Handling
- [ ] Review asset imports (images, fonts, etc.)
- [ ] Update any webpack-specific asset handling
- [ ] Test CSS imports and Tailwind CSS functionality

### Phase 6: TypeScript Configuration
- [ ] Update `tsconfig.json` if needed for Vite compatibility
- [ ] Ensure proper types for Vite's import.meta.env

### Phase 7: Testing and Validation
- [ ] Test development server: `npm start`
- [ ] Test production build: `npm run build`
- [ ] Test preview: `npm run preview`
- [ ] Verify all functionality works:
  - [ ] File upload
  - [ ] C3D processing
  - [ ] Data visualization
  - [ ] Authentication flow
  - [ ] All existing features

### Phase 8: Performance Comparison
- [ ] Measure dev server startup time (before/after)
- [ ] Measure hot reload speed
- [ ] Measure build time
- [ ] Compare bundle size

## Dependencies to Review
Current frontend dependencies that might need attention:
- `@types/jest: ^29.5.14` - May need Vitest migration
- `react-scripts: ^5.0.1` - To be removed
- Tailwind CSS setup - Should work with Vite
- Any other build-specific dependencies

## Potential Issues and Solutions
1. **Jest Testing** - Consider migrating to Vitest for better Vite integration
2. **CSS Modules** - Vite handles CSS modules differently than webpack
3. **Dynamic Imports** - May need syntax adjustments
4. **Service Worker** - Need to set up Vite PWA plugin if using

## Rollback Plan
If migration fails:
1. Revert package.json changes
2. Reinstall CRACO and react-scripts
3. Remove vite.config.ts
4. Keep detailed notes of issues for future attempt

## Success Criteria
- [ ] Development server starts successfully
- [ ] All existing functionality works
- [ ] Build completes without errors
- [ ] Production build works correctly
- [ ] Significant performance improvement in dev experience
- [ ] No breaking changes to user experience

## Time Estimate
- Setup and basic migration: 2-3 hours
- Testing and issue resolution: 2-4 hours
- Documentation updates: 1 hour
- **Total: 5-8 hours**

## Priority
**Medium** - Nice to have improvement, not blocking current development

## Prerequisites
- Ensure all current functionality is working
- Have good test coverage or manual testing checklist
- Backup current working state

## References
- [Vite React Plugin Documentation](https://github.com/vitejs/vite-plugin-react)
- [Migrating from CRA Guide](https://vitejs.dev/guide/migration.html)
- [Vite Configuration Reference](https://vitejs.dev/config/)