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
import { 
  MagnifyingGlassIcon, 
  ResetIcon,
  PersonIcon,
  CalendarIcon,
  ClockIcon,
  ArchiveIcon,
  BarChartIcon
} from '@radix-ui/react-icons';

interface FilterState {
  searchTerm: string;
  patientIdFilter: string;
  therapistIdFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
  timeFromFilter: string; // Format: "HH:MM" (24-hour)
  timeToFilter: string;   // Format: "HH:MM" (24-hour)
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
    timeFromFilter,
    timeToFilter,
    sizeFilter
  } = filters;

  const hasActiveFilters = searchTerm || patientIdFilter || therapistIdFilter || 
                          dateFromFilter || dateToFilter || timeFromFilter || timeToFilter || sizeFilter !== 'all';

  const activeFilterCount = [
    searchTerm && 'Search',
    patientIdFilter && 'Patient',
    therapistIdFilter && 'Therapist', 
    (dateFromFilter || dateToFilter) && 'Date',
    (timeFromFilter || timeToFilter) && 'Time',
    sizeFilter !== 'all' && 'Size'
  ].filter(Boolean).length;

  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
      {/* Header with filter summary */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <BarChartIcon className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Filter Data</h3>
          {hasActiveFilters && (
            <div className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              {activeFilterCount} active
            </div>
          )}
        </div>
        <Button 
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
          variant="outline"
          size="sm"
          className="text-slate-600 hover:text-slate-900 disabled:opacity-50"
        >
          <ResetIcon className="w-4 h-4 mr-1" />
          Reset filters
        </Button>
      </div>

      {/* Filter Controls */}
      <div className="p-4 space-y-6">
        {/* Row 1: Search and Identifiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search by name */}
          <div className="space-y-2">
            <Label htmlFor="search" className="text-sm font-medium text-slate-700 flex items-center gap-1">
              <MagnifyingGlassIcon className="w-4 h-4" />
              Search by name
              {searchTerm && <span className="w-2 h-2 bg-blue-500 rounded-full ml-1"></span>}
            </Label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="search"
                placeholder="File name..."
                value={searchTerm}
                onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
                className={`pl-10 transition-all ${searchTerm ? 'ring-2 ring-blue-200 border-blue-300 bg-blue-50/30' : 'focus:ring-2 focus:ring-blue-200'}`}
                aria-label="Search files by name"
              />
            </div>
          </div>

          {/* Filter by Patient */}
          <div className="space-y-2">
            <Label htmlFor="patient-id" className="text-sm font-medium text-slate-700 flex items-center gap-1">
              <PersonIcon className="w-4 h-4" />
              Patient
              {patientIdFilter && <span className="w-2 h-2 bg-blue-500 rounded-full ml-1"></span>}
            </Label>
            <Select 
              value={patientIdFilter || "all"} 
              onValueChange={(value) => onFiltersChange({ patientIdFilter: value === "all" ? "" : value })}
            >
              <SelectTrigger 
                className={`transition-all ${patientIdFilter ? 'ring-2 ring-blue-200 border-blue-300 bg-blue-50/30' : 'focus:ring-2 focus:ring-blue-200'}`}
                aria-label="Filter by patient ID"
              >
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
            <Label htmlFor="therapist-id" className="text-sm font-medium text-slate-700 flex items-center gap-1">
              <PersonIcon className="w-4 h-4" />
              Therapist
              {therapistIdFilter && <span className="w-2 h-2 bg-blue-500 rounded-full ml-1"></span>}
            </Label>
            <Select 
              value={therapistIdFilter || "all"} 
              onValueChange={(value) => onFiltersChange({ therapistIdFilter: value === "all" ? "" : value })}
            >
              <SelectTrigger 
                className={`transition-all ${therapistIdFilter ? 'ring-2 ring-blue-200 border-blue-300 bg-blue-50/30' : 'focus:ring-2 focus:ring-blue-200'}`}
                aria-label="Filter by therapist ID"
              >
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
        </div>

        {/* Row 2: Date and Time Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Session Date Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 flex items-center gap-1">
              <CalendarIcon className="w-4 h-4" />
              Session Date Range
              {(dateFromFilter || dateToFilter) && <span className="w-2 h-2 bg-blue-500 rounded-full ml-1"></span>}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFromFilter}
                onChange={(e) => onFiltersChange({ dateFromFilter: e.target.value })}
                className={`text-sm flex-1 transition-all ${dateFromFilter ? 'ring-2 ring-blue-200 border-blue-300 bg-blue-50/30' : 'focus:ring-2 focus:ring-blue-200'}`}
                placeholder="From date"
                aria-label="Filter from date"
              />
              <span className="text-sm text-slate-500 px-1 font-medium">to</span>
              <Input
                type="date"
                value={dateToFilter}
                onChange={(e) => onFiltersChange({ dateToFilter: e.target.value })}
                className={`text-sm flex-1 transition-all ${dateToFilter ? 'ring-2 ring-blue-200 border-blue-300 bg-blue-50/30' : 'focus:ring-2 focus:ring-blue-200'}`}
                placeholder="To date"
                aria-label="Filter to date"
              />
            </div>
          </div>

          {/* Time Range Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 flex items-center gap-1">
              <ClockIcon className="w-4 h-4" />
              Time Range
              {(timeFromFilter || timeToFilter) && <span className="w-2 h-2 bg-blue-500 rounded-full ml-1"></span>}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={timeFromFilter}
                onChange={(e) => onFiltersChange({ timeFromFilter: e.target.value })}
                className={`text-sm flex-1 transition-all ${timeFromFilter ? 'ring-2 ring-blue-200 border-blue-300 bg-blue-50/30' : 'focus:ring-2 focus:ring-blue-200'}`}
                placeholder="From time"
                aria-label="Filter from time"
              />
              <span className="text-sm text-slate-500 px-1 font-medium">to</span>
              <Input
                type="time"
                value={timeToFilter}
                onChange={(e) => onFiltersChange({ timeToFilter: e.target.value })}
                className={`text-sm flex-1 transition-all ${timeToFilter ? 'ring-2 ring-blue-200 border-blue-300 bg-blue-50/30' : 'focus:ring-2 focus:ring-blue-200'}`}
                placeholder="To time"
                aria-label="Filter to time"
              />
            </div>
          </div>

          {/* File Size Filter */}
          <div className="space-y-2">
            <Label htmlFor="size" className="text-sm font-medium text-slate-700 flex items-center gap-1">
              <ArchiveIcon className="w-4 h-4" />
              File Size
              {sizeFilter !== 'all' && <span className="w-2 h-2 bg-blue-500 rounded-full ml-1"></span>}
            </Label>
            <Select 
              value={sizeFilter} 
              onValueChange={(value: any) => onFiltersChange({ sizeFilter: value })}
            >
              <SelectTrigger 
                className={`transition-all ${sizeFilter !== 'all' ? 'ring-2 ring-blue-200 border-blue-300 bg-blue-50/30' : 'focus:ring-2 focus:ring-blue-200'}`}
                aria-label="Filter by file size"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sizes</SelectItem>
                <SelectItem value="small">&lt; 1 MB</SelectItem>
                <SelectItem value="medium">1-2 MB</SelectItem>
                <SelectItem value="large">&gt; 2 MB</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default C3DFilterPanel;
export type { FilterState };