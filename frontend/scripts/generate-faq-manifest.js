#!/usr/bin/env node
import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to FAQ content directory
const FAQ_DIR = join(__dirname, '..', 'public', 'content', 'faq');
const MANIFEST_OUTPUT = join(__dirname, '..', 'public', 'content', 'faq', 'manifest.json');

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir, baseDir = dir) {
  const files = [];
  
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Recursively search subdirectories
      files.push(...findMarkdownFiles(fullPath, baseDir));
    } else if (item.endsWith('.md')) {
      // Add markdown files with relative path from base directory
      const relativePath = relative(baseDir, fullPath);
      files.push(relativePath.replace(/\\/g, '/')); // Normalize path separators
    }
  }
  
  return files;
}

/**
 * Generate manifest of FAQ files
 */
function generateManifest() {
  try {
    console.log('📂 Scanning FAQ directory:', FAQ_DIR);
    
    // Find all markdown files
    const files = findMarkdownFiles(FAQ_DIR);
    
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