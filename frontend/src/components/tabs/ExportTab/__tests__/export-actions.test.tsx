/**
 * ExportActions Component Tests
 * Minimalist critical tests following KISS and DRY principles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ExportActions } from '../ExportActions';
import { ExportData } from '../types';

// Mock data
const mockExportData: ExportData = {
  metadata: {
    exportDate: '2025-01-19T00:00:00Z',
    fileName: 'test.c3d',
    exportVersion: '1.0.0',
    exportOptions: {
      includeAnalytics: true,
      includeSessionParams: false,
      includeC3dMetadata: false,
      includePerformanceAnalysis: false
    }
  }
};

describe('ExportActions Component', () => {
  const mockOnDownloadOriginal = vi.fn();
  const mockOnDownloadExport = vi.fn();

  const defaultProps = {
    exportData: mockExportData,
    originalFilename: 'test_file.c3d',
    hasSelectedData: true,
    onDownloadOriginal: mockOnDownloadOriginal,
    onDownloadExport: mockOnDownloadExport
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnDownloadOriginal.mockResolvedValue(undefined);
    mockOnDownloadExport.mockResolvedValue(undefined);
  });

  const renderComponent = (props = {}) => {
    const mergedProps = { ...defaultProps, ...props };
    return render(
      <TooltipProvider>
        <ExportActions {...mergedProps} />
      </TooltipProvider>
    );
  };

  describe('Basic Rendering', () => {
    it('should render download buttons', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /download original c3d/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export json data/i })).toBeInTheDocument();
    });

    it('should show original filename', () => {
      renderComponent();
      
      expect(screen.getByText(/test_file\.c3d/)).toBeInTheDocument();
    });
  });

  describe('Download Original File', () => {
    it('should call onDownloadOriginal when clicked', async () => {
      renderComponent();
      
      const button = screen.getByRole('button', { name: /download original c3d/i });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockOnDownloadOriginal).toHaveBeenCalledOnce();
      });
    });

    it('should show downloading state', async () => {
      const slowDownload = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(undefined), 50))
      );
      renderComponent({ onDownloadOriginal: slowDownload });
      
      const button = screen.getByRole('button', { name: /download original c3d/i });
      fireEvent.click(button);
      
      expect(screen.getByText('Downloading...')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByText('Downloaded!')).toBeInTheDocument();
      });
    });
  });

  describe('Download Export Data', () => {
    it('should call onDownloadExport when clicked', async () => {
      renderComponent();
      
      const button = screen.getByRole('button', { name: /export json data/i });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockOnDownloadExport).toHaveBeenCalledOnce();
      });
    });

    it('should be disabled when no data is selected', () => {
      renderComponent({ hasSelectedData: false });
      
      const button = screen.getByRole('button', { name: /export json data/i });
      expect(button).toBeDisabled();
    });

    it('should show alert when no data is selected', () => {
      renderComponent({ hasSelectedData: false });
      
      expect(screen.getByText(/select at least one export option/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle download errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingDownload = vi.fn().mockRejectedValue(new Error('Download failed'));
      
      renderComponent({ onDownloadOriginal: failingDownload });
      
      const button = screen.getByRole('button', { name: /download original c3d/i });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Original download failed:', expect.any(Error));
      });
      
      // Should return to normal state
      expect(screen.getByText('Download Original C3D')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });

  describe('File Size Display', () => {
    it('should show estimated size when export data exists', () => {
      renderComponent();
      
      expect(screen.getByText(/estimated size:/i)).toBeInTheDocument();
    });

    it('should show 0 KB when no export data', () => {
      renderComponent({ exportData: null });
      
      expect(screen.getByText('Estimated size: 0 KB')).toBeInTheDocument();
    });
  });
});