### **Actionable Migration Plan: From CRACO to Vite**

**Objective:** Execute a zero-downtime, non-breaking migration of the React frontend from a CRACO-based setup to Vite. The primary goals are to dramatically improve developer experience (DX) through faster tooling and to modernize the build pipeline.

**Success Criteria:**
*   The application is fully functional in both development and production environments post-migration.
*   All existing tests pass.
*   Developer startup time (`npm start`) and Hot Module Replacement (HMR) update times are reduced by at least 50%.
*   The production build is successful and deployable.

---

### **Phase 0: Pre-Flight Check & Scoping (1-2 hours)**

This preparatory phase is crucial to prevent unforeseen issues. Do not skip these steps.

*   [ ] **Branch Creation**: Create a new feature branch for the migration (e.g., `feat/vite-migration`).
*   [ ] **Establish Baseline**: Document the current state.
    *   [ ] Record current dev server start time: `time npm start`.
    *   [ ] Record current build time: `time npm run build`.
    *   [ ] Record the size of the production `build` directory.
*   [ ] **Audit `craco.config.js`**:
    *   Your current config only specifies a path alias: `'@': path.resolve(__dirname, 'src/')`. This is a straightforward migration.
    *   **Action**: Confirm no other Webpack plugins, PostCSS settings, or Babel modifications are present.
*   [ ] **Identify Environment Variables**:
    *   **Action**: Run `grep -r "REACT_APP_" src/` in your terminal to list all environment variables currently in use. Create a checklist from this output for Phase 3.
*   [ ] **Manual Test Plan**:
    *   **Action**: Quickly execute a full manual test of the application's critical paths (Authentication, Patient Search, C3D Analysis, Data Visualization). This will serve as your validation checklist in Phase 4.

### **Phase 1: Core Dependency & Configuration Switch (1 hour)**

This is the main surgical step. We will swap the engine of your application.

*   [ ] **Uninstall CRA Dependencies**:
    ```bash
    npm uninstall react-scripts @craco/craco
    ```

*   [ ] **Install Vite Dependencies**:
    ```bash
    npm install --save-dev vite @vitejs/plugin-react @types/node
    ```
    *Note: `@types/node` is required for using `path` and `__dirname` in your Vite config file.*

*   [ ] **Create `vite.config.ts`**: Create this file at the project root.
    ```typescript
    import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'
    import path from 'path'

    // https://vitejs.dev/config/
    export default defineConfig({
      plugins: [react()],
      resolve: {
        alias: {
          // This directly replaces your craco alias configuration
          '@': path.resolve(__dirname, 'src'),
        }
      },
      server: {
        // Optional: Define a port if you had one set in a .env file for CRA
        port: 3000
      },
      build: {
        // This sets the output directory to 'build' to match CRA's default
        outDir: 'build'
      }
    })
    ```

*   [ ] **Update `package.json` Scripts**:
    ```json
    "scripts": {
      "start": "vite",
      "build": "tsc && vite build",
      "preview": "vite preview",
      "test": "jest" // We will address testing in Phase 5
    },
    ```

### **Phase 2: Project Structure & Asset Adjustments (1 hour)**

Vite has a different entry point and asset handling model than CRA.

*   [ ] **Move `index.html`**:
    *   **Action**: Move `public/index.html` to the project root directory (`./index.html`). Vite uses this as the main entry point.

*   [ ] **Update `index.html`**:
    *   **Action**: Remove all instances of `%PUBLIC_URL%`. Vite handles static assets from the `public` directory automatically. For example, change `<link rel="icon" href="%PUBLIC_URL%/favicon.ico" />` to `<link rel="icon" href="/favicon.ico" />`.
    *   **Action**: Add the module script tag at the end of the `<body>` section, replacing the standard CRA script injection.
        ```html
        <!-- Add this line -->
        <script type="module" src="/src/index.tsx"></script> 
        <!-- Your main entry file might be main.tsx, index.tsx, etc. Verify the path. -->
        ```

*   [ ] **Update `tsconfig.json` for Vite**:
    *   **Action**: Ensure your `tsconfig.json` aligns with modern ESM standards used by Vite.
        ```json
        {
          "compilerOptions": {
            // ... your existing options
            "target": "ESNext",
            "module": "ESNext",
            "moduleResolution": "bundler", // Or "node" if "bundler" causes issues
            "isolatedModules": true,
            "noEmit": true,
            // Add this if you get errors about import.meta
            "types": ["vite/client"] 
          },
          // ...
        }
        ```

### **Phase 3: Environment Variable Migration (1 hour)**

This is a critical step for ensuring your app connects to services like Supabase correctly.

*   [ ] **Rename Variables**:
    *   **Action**: For every variable identified in Phase 0 (e.g., `REACT_APP_SUPABASE_URL`), rename it to use the `VITE_` prefix (e.g., `VITE_SUPABASE_URL`) in all your `.env` files (`.env`, `.env.local`, etc.).
*   [ ] **Update Code References**:
    *   **Action**: Perform a project-wide search and replace for `process.env.REACT_APP_` and change it to `import.meta.env.VITE_`.
    *   **Example**:
        *   **Before**: `const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;`
        *   **After**: `const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;`

### **Phase 4: Testing and Validation (2-3 hours)**

Verify that the migration was successful.

*   [ ] **Start Development Server**:
    *   **Action**: Run `npm start`. The server should start significantly faster.
    *   **Validation**: Open your browser to the local URL. The app should render without console errors.
*   [ ] **Hot Module Replacement (HMR) Test**:
    *   **Action**: Make a small visual change to a React component (e.g., change button text).
    *   **Validation**: The change should appear in the browser almost instantly without a full page reload.
*   [ ] **Execute Manual Test Plan**:
    *   **Action**: Go through the critical path checklist you created in Phase 0.
        *   [ ] Verify Authentication flow (Login/Logout).
        *   [ ] Verify Patient Search and Data Display.
        *   [ ] Verify C3D Analysis functionality.
        *   [ ] Verify Data Visualization components.
        *   [ ] Verify file uploads and any other key features.
*   [ ] **Test Production Build**:
    *   **Action**: Run `npm run build` followed by `npm run preview`.
    *   **Validation**: This will serve your production build locally. Repeat the manual test plan on this preview instance to catch any production-only issues.

### **Phase 5: Post-Migration Cleanup & Optimization (Optional, 2-4 hours)**

*   [ ] **Migrate to Vitest (Highly Recommended)**: `jest` can work with Vite, but `vitest` provides a seamless, faster, and integrated experience.
    *   **Action**: Install Vitest: `npm install --save-dev vitest @vitest/ui jsdom`.
    *   **Action**: Create a `vite.config.ts` entry for Vitest.
    *   **Action**: Update your `package.json` test script: `"test": "vitest --ui"`.
    *   **Benefit**: Your test environment will now be consistent with your dev and build environments.
*   [ ] **Update CI/CD Pipeline**:
    *   **Action**: Modify your deployment scripts (`Dockerfile`, `Jenkinsfile`, GitHub Actions, etc.) to use the new `npm start`, `npm run build` commands and handle the `build` directory.
*   [ ] **Performance Comparison**:
    *   **Action**: Re-run the performance measurements from Phase 0 and document the improvements in your branch's pull request. This demonstrates the value of the migration.

### **Rollback Plan**

If significant issues arise that cannot be resolved within a few hours, execute this plan to revert to the stable CRACO state.

1.  **Stash or discard all changes**: `git checkout -- .` or `git stash`.
2.  **Revert `package.json`**: `git checkout main -- package.json package-lock.json`.
3.  **Re-install old dependencies**: `npm install`.
4.  The project will now be back in its original state. Analyze the issues encountered before re-attempting the migration.