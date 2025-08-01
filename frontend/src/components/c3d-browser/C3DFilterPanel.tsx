import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MagnifyingGlassIcon, TrashIcon } from '@radix-ui/react-icons';

interface FilterState {
  searchTerm: string;
  patientIdFilter: string;
  therapistIdFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
  sizeFilter: 'all' | 'small' | 'medium' | 'large';
}

interface C3DFilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  onClearFilters: () => void;
  uniquePatientIds: string[];
  uniqueTherapistIds: string[];
  className?: string;
}

const C3DFilterPanel: React.FC<C3DFilterPanelProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  uniquePatientIds,
  uniqueTherapistIds,
  className = ''
}) => {
  const {
    searchTerm,
    patientIdFilter,
    therapistIdFilter,
    dateFromFilter,
    dateToFilter,
    sizeFilter
  } = filters;

  const hasActiveFilters = searchTerm || patientIdFilter || therapistIdFilter || 
                          dateFromFilter || dateToFilter || sizeFilter !== 'all';

  const activeFilterCount = [
    searchTerm && 'Search',
    patientIdFilter && 'Patient',
    therapistIdFilter && 'Therapist', 
    (dateFromFilter || dateToFilter) && 'Date',
    sizeFilter !== 'all' && 'Size'
  ].filter(Boolean).length;

  return (
    <div className={`bg-slate-50 p-4 rounded-lg space-y-4 ${className}`}>
      {/* Two-row grid layout for desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search by name */}
        <div className="space-y-2">
          <Label htmlFor="search" className="text-sm font-medium flex items-center">
            Search by name
            {searchTerm && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
          </Label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="search"
              placeholder="File name..."
              value={searchTerm}
              onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
              className={`pl-10 ${searchTerm ? 'ring-2 ring-blue-200 border-blue-300' : ''}`}
            />
          </div>
        </div>

        {/* Filter by Patient */}
        <div className="space-y-2">
          <Label htmlFor="patient-id" className="text-sm font-medium flex items-center">
            Patient
            {patientIdFilter && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
          </Label>
          <Select 
            value={patientIdFilter || "all"} 
            onValueChange={(value) => onFiltersChange({ patientIdFilter: value === "all" ? "" : value })}
          >
            <SelectTrigger className={patientIdFilter ? 'ring-2 ring-blue-200 border-blue-300' : ''}>
              <SelectValue placeholder="All patients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All patients</SelectItem>
              {uniquePatientIds.map(id => (
                <SelectItem key={id} value={id}>{id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter by Therapist */}
        <div className="space-y-2">
          <Label htmlFor="therapist-id" className="text-sm font-medium flex items-center">
            Therapist
            {therapistIdFilter && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
          </Label>
          <Select 
            value={therapistIdFilter || "all"} 
            onValueChange={(value) => onFiltersChange({ therapistIdFilter: value === "all" ? "" : value })}
          >
            <SelectTrigger className={therapistIdFilter ? 'ring-2 ring-blue-200 border-blue-300' : ''}>
              <SelectValue placeholder="All therapists" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All therapists</SelectItem>
              {uniqueTherapistIds.map(id => (
                <SelectItem key={id} value={id}>{id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Row 1 - Active filters summary */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-600">
            Active filters
          </Label>
          <div className="text-xs text-slate-600 bg-blue-50 px-2 py-2 rounded border text-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full inline-block mr-1"></span>
            {activeFilterCount} active
          </div>
        </div>

        {/* Row 2 - Filter by size */}
        <div className="space-y-2">
          <Label htmlFor="size" className="text-sm font-medium flex items-center">
            File size
            {sizeFilter !== 'all' && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
          </Label>
          <Select 
            value={sizeFilter} 
            onValueChange={(value: any) => onFiltersChange({ sizeFilter: value })}
          >
            <SelectTrigger className={sizeFilter !== 'all' ? 'ring-2 ring-blue-200 border-blue-300' : ''}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sizes</SelectItem>
              <SelectItem value="small">Small (&lt; 2MB)</SelectItem>
              <SelectItem value="medium">Medium (2-10MB)</SelectItem>
              <SelectItem value="large">Large (&gt; 10MB)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Row 2 - Filter by session date range (spans 2 columns) */}
        <div className="space-y-2 lg:col-span-2">
          <Label className="text-sm font-medium flex items-center">
            Session Date Range
            {(dateFromFilter || dateToFilter) && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFromFilter}
              onChange={(e) => onFiltersChange({ dateFromFilter: e.target.value })}
              className={`text-sm flex-1 ${dateFromFilter ? 'ring-2 ring-blue-200 border-blue-300' : ''}`}
              placeholder="From"
            />
            <span className="text-sm text-slate-500 px-1">to</span>
            <Input
              type="date"
              value={dateToFilter}
              onChange={(e) => onFiltersChange({ dateToFilter: e.target.value })}
              className={`text-sm flex-1 ${dateToFilter ? 'ring-2 ring-blue-200 border-blue-300' : ''}`}
              placeholder="To"
            />
          </div>
        </div>

        {/* Row 2 - Clear filters button */}
        <div className="space-y-2">
          <Label className="text-sm font-medium invisible">Actions</Label>
          <Button 
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
            variant="destructive"
            size="sm"
            className="w-full disabled:opacity-50 bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
          >
            <TrashIcon className="w-4 h-4 mr-2" />
            Clear all filters
          </Button>
        </div>
      </div>
    </div>
  );
};

export default C3DFilterPanel;
export type { FilterState };