#!/usr/bin/env node
import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to public directory (FAQ files are now at root)
const PUBLIC_DIR = join(__dirname, '..', 'public');
const MANIFEST_OUTPUT = join(__dirname, '..', 'public', 'faq-manifest.json');

/**
 * Find all FAQ markdown files (starting with 'faq-')
 */
function findFAQMarkdownFiles(dir) {
  const files = [];
  
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    // Only look for FAQ files at root level (not in subdirectories)
    if (!stat.isDirectory() && item.startsWith('faq-') && item.endsWith('.md')) {
      files.push(item); // Just the filename, no path needed since they're at root
    }
  }
  
  return files;
}

/**
 * Generate manifest of FAQ files
 */
function generateManifest() {
  try {
    console.log('📂 Scanning public directory for FAQ files:', PUBLIC_DIR);
    console.log('🔍 Working directory:', process.cwd());
    console.log('🗂️ Script directory:', __dirname);
    
    // Check if public directory exists
    try {
      const stat = statSync(PUBLIC_DIR);
      console.log('📁 Public directory exists:', stat.isDirectory());
    } catch (error) {
      console.error('❌ Public directory does not exist:', PUBLIC_DIR);
      console.error('Error:', error.message);
      
      // Create empty manifest on error
      const emptyManifest = {
        version: '1.0.0',
        generated: new Date().toISOString(),
        files: [],
        count: 0,
        error: 'Public directory not found',
        searchedPath: PUBLIC_DIR
      };
      writeFileSync(MANIFEST_OUTPUT, JSON.stringify(emptyManifest, null, 2));
      console.log('📝 Created empty manifest due to directory error');
      return emptyManifest;
    }
    
    // Find all FAQ markdown files (starting with 'faq-')
    const files = findFAQMarkdownFiles(PUBLIC_DIR);
    
    // Sort files for consistent ordering
    files.sort();
    
    // Create manifest object
    const manifest = {
      version: '1.0.0',
      generated: new Date().toISOString(),
      files: files,
      count: files.length
    };
    
    // Write manifest to file
    writeFileSync(MANIFEST_OUTPUT, JSON.stringify(manifest, null, 2));
    
    console.log('✅ FAQ manifest generated successfully');
    console.log(`📝 Found ${files.length} FAQ files`);
    console.log('📍 Manifest saved to:', MANIFEST_OUTPUT);
    
    // Log discovered files for debugging
    console.log('\n📋 Discovered FAQ files:');
    files.forEach(file => console.log(`  - ${file}`));
    
    return manifest;
  } catch (error) {
    console.error('❌ Error generating FAQ manifest:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateManifest();
}

export { generateManifest };