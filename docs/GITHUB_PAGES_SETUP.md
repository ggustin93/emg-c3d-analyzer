# GitHub Pages Setup Instructions

## Automatic Setup
The GitHub Actions workflow will attempt to automatically enable GitHub Pages when it runs. However, if this fails, follow the manual setup instructions below.

## Manual Setup Instructions

1. **Navigate to Repository Settings**
   - Go to https://github.com/ggustin93/emg-c3d-analyzer
   - Click on "Settings" tab

2. **Enable GitHub Pages**
   - In the left sidebar, click on "Pages" under "Code and automation"
   - Under "Source", select "GitHub Actions" from the dropdown
   - Click "Save"

3. **Verify Deployment Environment**
   - Still in Pages settings, ensure "github-pages" environment is created
   - This should happen automatically after the first deployment attempt

4. **Run the Workflow**
   - Go to the "Actions" tab
   - Select "Deploy Documentation to GitHub Pages"
   - Click "Run workflow" button
   - Select the main branch and click "Run workflow"

## Troubleshooting

### Error: "Not Found - get-a-apiname-pages-site"
This error occurs when GitHub Pages is not enabled. Follow the manual setup instructions above.

### Error: "Resource not accessible by integration"
This typically means the workflow doesn't have proper permissions:
1. Go to Settings → Actions → General
2. Under "Workflow permissions", select "Read and write permissions"
3. Check "Allow GitHub Actions to create and approve pull requests"
4. Save the changes

### Build Failures
If the build fails:
1. Check that the `docusaurus` folder exists and contains valid documentation
2. Ensure `package-lock.json` is committed
3. Verify the build works locally with:
   ```bash
   cd docusaurus
   npm install
   npm run build
   ```

## Access Your Documentation
Once successfully deployed, your documentation will be available at:
https://ggustin93.github.io/emg-c3d-analyzer/

## Local Development
To run the documentation locally:
```bash
cd docusaurus
npm install
npm run start
```
This will start a development server at http://localhost:3000/emg-c3d-analyzer/