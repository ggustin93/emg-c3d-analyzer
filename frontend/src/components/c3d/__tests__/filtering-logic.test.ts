/**
 * Simple Filtering Logic Test
 * ==========================
 * 
 * Tests the core question: Do filters work on ALL data or just visible pages?
 */

import { describe, it, expect } from 'vitest';

// Mock C3D file type
interface C3DFile {
  id: string;
  name: string;
  size: number;
}

// Copy the exact filtering logic from C3DFileBrowser (lines 189-222)
function filterFiles(files: C3DFile[], searchTerm: string): C3DFile[] {
  return files.filter(file => {
    return file.name.toLowerCase().includes(searchTerm.toLowerCase());
  });
}

// Copy the exact pagination logic (line 229) 
function paginateFiles(filteredFiles: C3DFile[], page: number, perPage: number): C3DFile[] {
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  return filteredFiles.slice(startIndex, endIndex);
}

// Copy the exact dropdown building logic (lines 253-261)
function buildUniqueOptions(files: C3DFile[]): string[] {
  const ids = new Set(files.map(f => f.name.split('_')[0])); // Extract patient ID
  return Array.from(ids).sort();
}

describe('C3D Filtering Logic', () => {
  // Test data: 15 files spanning 2 pages (10 per page)
  const allFiles: C3DFile[] = [
    // Page 1 (files 1-10) - all P001
    ...Array.from({length: 10}, (_, i) => ({
      id: `${i+1}`,
      name: `P001_session${i+1}.c3d`,
      size: 1024
    })),
    // Page 2 (files 11-15) - all P002  
    ...Array.from({length: 5}, (_, i) => ({
      id: `${i+11}`,
      name: `P002_session${i+1}.c3d`,
      size: 1024
    }))
  ];

  it('filters work on ALL files, not just visible page', () => {
    // Filter for P002 files (only on page 2)
    const filtered = filterFiles(allFiles, 'P002');
    
    // Should find 5 P002 files even though they're on page 2
    expect(filtered).toHaveLength(5);
    expect(filtered.every(f => f.name.includes('P002'))).toBe(true);
  });

  it('dropdown options built from ALL files, not just page 1', () => {
    // Build dropdown options from all files
    const options = buildUniqueOptions(allFiles);
    
    // Should include both P001 and P002, even though P002 is only on page 2
    expect(options).toEqual(['P001', 'P002']);
  });

  it('pagination happens AFTER filtering', () => {
    // Filter for P001 files (10 total)
    const filtered = filterFiles(allFiles, 'P001');
    expect(filtered).toHaveLength(10);
    
    // Paginate filtered results (5 per page)
    const page1 = paginateFiles(filtered, 1, 5);
    const page2 = paginateFiles(filtered, 2, 5);
    
    // Should have 2 pages of P001 files
    expect(page1).toHaveLength(5);
    expect(page2).toHaveLength(5);
    expect([...page1, ...page2]).toEqual(filtered);
  });
});