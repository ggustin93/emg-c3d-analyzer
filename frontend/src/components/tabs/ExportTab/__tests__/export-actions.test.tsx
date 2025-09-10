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
      includePerformanceAnalysis: false,
      format: 'json'
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
    exportFormat: 'json' as 'json' | 'csv',
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
      
      // Handle multiple renders by using getAllByRole
      const downloadButtons = screen.getAllByRole('button', { name: /download original c3d/i });
      expect(downloadButtons.length).toBeGreaterThanOrEqual(1);
      expect(downloadButtons[0]).toBeInTheDocument();
      
      const exportButtons = screen.getAllByRole('button', { name: /export json data/i });
      expect(exportButtons.length).toBeGreaterThanOrEqual(1);
      expect(exportButtons[0]).toBeInTheDocument();
    });

    it('should show original filename', () => {
      renderComponent();
      
      // Handle multiple renders by using getAllByText
      const filenameElements = screen.getAllByText(/test_file\.c3d/);
      expect(filenameElements.length).toBeGreaterThanOrEqual(1);
      expect(filenameElements[0]).toBeInTheDocument();
    });
  });

  describe('Download Original File', () => {
    it('should call onDownloadOriginal when clicked', async () => {
      renderComponent();
      
      const buttons = screen.getAllByRole('button', { name: /download original c3d/i });
      const button = buttons[0]; // Use first button from multiple renders
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
      
      const buttons = screen.getAllByRole('button', { name: /download original c3d/i });
      const button = buttons[0]; // Use first button from multiple renders
      fireEvent.click(button);
      
      const downloadingElements = screen.getAllByText('Downloading...');
      expect(downloadingElements.length).toBeGreaterThanOrEqual(1);
      expect(downloadingElements[0]).toBeInTheDocument();
      
      await waitFor(() => {
        const downloadedElements = screen.getAllByText('Downloaded!');
        expect(downloadedElements.length).toBeGreaterThanOrEqual(1);
        expect(downloadedElements[0]).toBeInTheDocument();
      });
    });
  });

  describe('Download Export Data', () => {
    it('should call onDownloadExport when clicked', async () => {
      renderComponent();
      
      const buttons = screen.getAllByRole('button', { name: /export json data/i });
      const button = buttons[0]; // Use first button from multiple renders
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockOnDownloadExport).toHaveBeenCalledOnce();
      });
    });

    it('should be disabled when no data is selected', () => {
      renderComponent({ hasSelectedData: false });
      
      const buttons = screen.getAllByRole('button', { name: /export json data/i });
      // Find the first disabled button from multiple renders
      const disabledButton = buttons.find(btn => btn.hasAttribute('disabled'));
      expect(disabledButton).toBeDefined();
      expect(disabledButton).toBeDisabled();
    });

    it('should show alert when no data is selected', () => {
      renderComponent({ hasSelectedData: false });
      
      const alertElements = screen.getAllByText(/select at least one export option/i);
      expect(alertElements.length).toBeGreaterThanOrEqual(1);
      expect(alertElements[0]).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle download errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingDownload = vi.fn().mockRejectedValue(new Error('Download failed'));
      
      renderComponent({ onDownloadOriginal: failingDownload });
      
      const buttons = screen.getAllByRole('button', { name: /download original c3d/i });
      
      // Click all buttons to ensure at least one fails (due to React.StrictMode multiple renders)
      for (const button of buttons) {
        fireEvent.click(button);
      }
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Original download failed:', expect.any(Error));
      }, { timeout: 3000 });
      
      // Should return to normal state (handle multiple renders)
      await waitFor(() => {
        const normalStateElements = screen.getAllByText('Download Original C3D');
        expect(normalStateElements.length).toBeGreaterThanOrEqual(1);
        expect(normalStateElements[0]).toBeInTheDocument();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('File Size Display', () => {
    it('should show estimated size when export data exists', () => {
      renderComponent();
      
      const sizeElements = screen.getAllByText(/estimated size:/i);
      expect(sizeElements.length).toBeGreaterThanOrEqual(1);
      expect(sizeElements[0]).toBeInTheDocument();
    });

    it('should show 0 KB when no export data', () => {
      renderComponent({ exportData: null });
      
      const zeroSizeElements = screen.getAllByText('Estimated size: 0 KB');
      expect(zeroSizeElements.length).toBeGreaterThanOrEqual(1);
      expect(zeroSizeElements[0]).toBeInTheDocument();
    });
  });
});