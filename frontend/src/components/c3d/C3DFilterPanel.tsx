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
  Cross2Icon,
  PersonIcon,
  CalendarIcon,
  ClockIcon,
  ArchiveIcon,
  FileTextIcon
} from '@radix-ui/react-icons';

interface FilterState {
  searchTerm: string;
  patientIdFilter: string;
  therapistIdFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
  timeFromFilter: string; // Format: "HH:MM" (24-hour)
  timeToFilter: string;   // Format: "HH:MM" (24-hour)
  sizeFilter: string;
  clinicalNotesFilter: string;
}

interface C3DFilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  onClearFilters: () => void;
  className?: string;
  uniquePatientIds?: string[];
  uniqueTherapistNames?: string[];
}

const C3DFilterPanel: React.FC<C3DFilterPanelProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  className = '',
  uniquePatientIds = [],
  uniqueTherapistNames = []
}) => {
  const {
    searchTerm,
    patientIdFilter,
    therapistIdFilter,
    dateFromFilter,
    dateToFilter,
    timeFromFilter,
    timeToFilter,
    sizeFilter,
    clinicalNotesFilter
  } = filters;

  // Calculate active filter count for badge display
  const activeFilterCount = [
    searchTerm && 'Search',
    patientIdFilter && patientIdFilter !== 'all' && 'Patient',
    therapistIdFilter && therapistIdFilter !== 'all' && 'Therapist', 
    (dateFromFilter || dateToFilter) && 'Date',
    (timeFromFilter || timeToFilter) && 'Time',
    sizeFilter !== 'all' && 'Size',
    clinicalNotesFilter !== 'all' && 'Clinical Notes'
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className={`bg-white border-2 border-primary/80 rounded-lg shadow-md ring-1 ring-primary/30 py-2 ${className}`}>
      {/* Enhanced filter summary */}
      {hasActiveFilters && (
        <div className="px-6 py-4 border-b border-primary/10 bg-gradient-to-r from-primary/5 to-primary/3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs bg-primary/10 text-primary-foreground px-3 py-2 rounded-full">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                <span className="font-semibold text-primary">{activeFilterCount} Active Filter{activeFilterCount > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {searchTerm && (
                  <div className="text-xs bg-white/60 text-primary px-2 py-1 rounded-md border border-primary/20">
                    Search: "{searchTerm}"
                  </div>
                )}
                {patientIdFilter && patientIdFilter !== 'all' && (
                  <div className="text-xs bg-white/60 text-secondary px-2 py-1 rounded-md border border-secondary/20">
                    Patient: {patientIdFilter}
                  </div>
                )}
                {therapistIdFilter && therapistIdFilter !== 'all' && (
                  <div className="text-xs bg-white/60 text-secondary px-2 py-1 rounded-md border border-secondary/20">
                    Therapist: {therapistIdFilter}
                  </div>
                )}
                {(dateFromFilter || dateToFilter) && (
                  <div className="text-xs bg-white/60 text-primary px-2 py-1 rounded-md border border-primary/20">
                    Date: {dateFromFilter || '...'} - {dateToFilter || '...'}
                  </div>
                )}
                {sizeFilter !== 'all' && (
                  <div className="text-xs bg-white/60 text-secondary px-2 py-1 rounded-md border border-secondary/20">
                    Size: {sizeFilter}
                  </div>
                )}
                {clinicalNotesFilter !== 'all' && (
                  <div className="text-xs bg-white/60 text-secondary px-2 py-1 rounded-md border border-secondary/20">
                    {clinicalNotesFilter === 'with_notes' ? 'With Notes' : 'No Notes'}
                  </div>
                )}
              </div>
            </div>
            <Button
              onClick={onClearFilters}
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary-foreground hover:bg-primary/10 transition-colors"
              aria-label="Clear all filters"
            >
              <Cross2Icon className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="p-3 space-y-3">
        {/* Row 1: Search, Patient, Therapist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Search by name */}
          <div className="space-y-2">
            <Label htmlFor="search" className="text-sm font-medium text-foreground flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-secondary/50 flex items-center justify-center">
                <MagnifyingGlassIcon className="w-3 h-3 text-secondary-foreground" />
              </div>
              <span>Search by name</span>
              {searchTerm && <span className="w-2 h-2 bg-secondary-foreground rounded-full ml-1"></span>}
            </Label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
                className={`pl-10 transition-all focus-visible:ring-0 focus-visible:ring-offset-0 ${searchTerm ? 'pr-9 ring-1 ring-blue-400 border-blue-400 bg-blue-50/30' : 'focus:ring-1 focus:ring-blue-400 focus:border-blue-400'}`}
                aria-label="Search files by name"
              />
              {searchTerm && (
                <button
                  onClick={() => onFiltersChange({ searchTerm: '' })}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 hover:bg-secondary rounded-md transition-all"
                  aria-label="Clear search"
                >
                  <Cross2Icon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Filter by Patient */}
          <div className="space-y-2">
            <Label htmlFor="patient-id" className="text-sm font-medium text-foreground flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-secondary/50 flex items-center justify-center">
                <PersonIcon className="w-3 h-3 text-secondary-foreground" />
              </div>
              <span>Patient</span>
              {patientIdFilter && patientIdFilter !== 'all' && <span className="w-2 h-2 bg-secondary-foreground rounded-full ml-1"></span>}
              {patientIdFilter && patientIdFilter !== 'all' && (
                <button
                  onClick={() => onFiltersChange({ patientIdFilter: 'all' })}
                  className="ml-auto p-1.5 hover:bg-secondary rounded-md transition-all"
                  aria-label="Clear patient filter"
                >
                  <Cross2Icon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </Label>
            <Select 
              value={patientIdFilter} 
              onValueChange={(value: any) => onFiltersChange({ patientIdFilter: value })}
            >
              <SelectTrigger 
                className={`transition-all focus-visible:ring-0 focus-visible:ring-offset-0 ${patientIdFilter && patientIdFilter !== 'all' ? 'ring-1 ring-blue-400 border-blue-400 bg-blue-50/30' : 'focus:ring-1 focus:ring-blue-400 focus:border-blue-400'}`}
                aria-label="Filter by patient"
              >
                <SelectValue placeholder="All patients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All patients</SelectItem>
                {uniquePatientIds.map((patient) => (
                  <SelectItem key={patient} value={patient}>{patient}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter by Therapist */}
          <div className="space-y-2">
            <Label htmlFor="therapist-id" className="text-sm font-medium text-foreground flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-secondary/50 flex items-center justify-center">
                <PersonIcon className="w-3 h-3 text-secondary-foreground" />
              </div>
              <span>Therapist</span>
              {therapistIdFilter && therapistIdFilter !== 'all' && <span className="w-2 h-2 bg-secondary-foreground rounded-full ml-1"></span>}
              {therapistIdFilter && therapistIdFilter !== 'all' && (
                <button
                  onClick={() => onFiltersChange({ therapistIdFilter: 'all' })}
                  className="ml-auto p-1.5 hover:bg-secondary rounded-md transition-all"
                  aria-label="Clear therapist filter"
                >
                  <Cross2Icon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </Label>
            <Select 
              value={therapistIdFilter} 
              onValueChange={(value: any) => onFiltersChange({ therapistIdFilter: value })}
            >
              <SelectTrigger 
                className={`transition-all focus-visible:ring-0 focus-visible:ring-offset-0 ${therapistIdFilter && therapistIdFilter !== 'all' ? 'ring-1 ring-blue-400 border-blue-400 bg-blue-50/30' : 'focus:ring-1 focus:ring-blue-400 focus:border-blue-400'}`}
                aria-label="Filter by therapist"
              >
                <SelectValue placeholder="All therapists" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All therapists</SelectItem>
                {uniqueTherapistNames.map((therapist) => (
                  <SelectItem key={therapist} value={therapist}>{therapist}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Date Range, Time Range, Size, Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1.5fr_1fr_1fr] gap-3">
          {/* Date Range Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-secondary/50 flex items-center justify-center">
                <CalendarIcon className="w-3 h-3 text-secondary-foreground" />
              </div>
              <span>Date Range</span>
              {(dateFromFilter || dateToFilter) && <span className="w-2 h-2 bg-secondary-foreground rounded-full ml-1"></span>}
              {(dateFromFilter || dateToFilter) && (
                <button
                  onClick={() => onFiltersChange({ dateFromFilter: '', dateToFilter: '' })}
                  className="ml-auto p-1.5 hover:bg-secondary rounded-md transition-all"
                  aria-label="Clear date filter"
                >
                  <Cross2Icon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                type="date"
                id="date-from"
                placeholder="From"
                value={dateFromFilter}
                onChange={(e) => onFiltersChange({ dateFromFilter: e.target.value })}
                className={`transition-all text-xs ${dateFromFilter ? 'ring-1 ring-blue-400 border-blue-400 bg-blue-50/30' : 'focus:ring-1 focus:ring-blue-400 focus:border-blue-400'}`}
                aria-label="Filter from date"
              />
              <Input
                type="date"
                id="date-to"
                placeholder="To"
                value={dateToFilter}
                onChange={(e) => onFiltersChange({ dateToFilter: e.target.value })}
                className={`transition-all text-xs ${dateToFilter ? 'ring-1 ring-blue-400 border-blue-400 bg-blue-50/30' : 'focus:ring-1 focus:ring-blue-400 focus:border-blue-400'}`}
                aria-label="Filter to date"
              />
            </div>
          </div>

          {/* Time Range Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-secondary/50 flex items-center justify-center">
                <ClockIcon className="w-3 h-3 text-secondary-foreground" />
              </div>
              <span>Time Range</span>
              {(timeFromFilter || timeToFilter) && <span className="w-2 h-2 bg-secondary-foreground rounded-full ml-1"></span>}
              {(timeFromFilter || timeToFilter) && (
                <button
                  onClick={() => onFiltersChange({ timeFromFilter: '', timeToFilter: '' })}
                  className="ml-auto p-1.5 hover:bg-secondary rounded-md transition-all"
                  aria-label="Clear time filter"
                >
                  <Cross2Icon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                type="time"
                id="time-from"
                placeholder="From"
                value={timeFromFilter}
                onChange={(e) => onFiltersChange({ timeFromFilter: e.target.value })}
                className={`transition-all text-xs ${timeFromFilter ? 'ring-1 ring-blue-400 border-blue-400 bg-blue-50/30' : 'focus:ring-1 focus:ring-blue-400 focus:border-blue-400'}`}
                aria-label="Filter from time"
              />
              <Input
                type="time"
                id="time-to"
                placeholder="To"
                value={timeToFilter}
                onChange={(e) => onFiltersChange({ timeToFilter: e.target.value })}
                className={`transition-all text-xs ${timeToFilter ? 'ring-1 ring-blue-400 border-blue-400 bg-blue-50/30' : 'focus:ring-1 focus:ring-blue-400 focus:border-blue-400'}`}
                aria-label="Filter to time"
              />
            </div>
          </div>

          {/* File Size Filter */}
          <div className="space-y-2">
            <Label htmlFor="size-filter" className="text-sm font-medium text-foreground flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-secondary/50 flex items-center justify-center">
                <ArchiveIcon className="w-3 h-3 text-secondary-foreground" />
              </div>
              <span>Size</span>
              {sizeFilter !== 'all' && <span className="w-2 h-2 bg-secondary-foreground rounded-full ml-1"></span>}
              {sizeFilter !== 'all' && (
                <button
                  onClick={() => onFiltersChange({ sizeFilter: 'all' })}
                  className="ml-auto p-1.5 hover:bg-secondary rounded-md transition-all"
                  aria-label="Clear size filter"
                >
                  <Cross2Icon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </Label>
            <Select 
              value={sizeFilter} 
              onValueChange={(value: any) => onFiltersChange({ sizeFilter: value })}
            >
              <SelectTrigger 
                className={`transition-all text-xs ${sizeFilter !== 'all' ? 'ring-1 ring-blue-400 border-blue-400 bg-blue-50/30' : 'focus:ring-1 focus:ring-blue-400 focus:border-blue-400'}`}
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
          
          {/* Clinical Notes Filter */}
          <div className="space-y-2">
            <Label htmlFor="clinical-notes" className="text-sm font-medium text-foreground flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-secondary/50 flex items-center justify-center">
                <FileTextIcon className="w-3 h-3 text-secondary-foreground" />
              </div>
              <span>Notes</span>
              {clinicalNotesFilter !== 'all' && <span className="w-2 h-2 bg-secondary-foreground rounded-full ml-1"></span>}
              {clinicalNotesFilter !== 'all' && (
                <button
                  onClick={() => onFiltersChange({ clinicalNotesFilter: 'all' })}
                  className="ml-auto p-1.5 hover:bg-secondary rounded-md transition-all"
                  aria-label="Clear clinical notes filter"
                >
                  <Cross2Icon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </Label>
            <Select 
              value={clinicalNotesFilter} 
              onValueChange={(value: any) => onFiltersChange({ clinicalNotesFilter: value })}
            >
              <SelectTrigger 
                className={`transition-all text-xs ${clinicalNotesFilter !== 'all' ? 'ring-1 ring-blue-400 border-blue-400 bg-blue-50/30' : 'focus:ring-1 focus:ring-blue-400 focus:border-blue-400'}`}
                aria-label="Filter by clinical notes presence"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sessions</SelectItem>
                <SelectItem value="with_notes">With notes</SelectItem>
                <SelectItem value="without_notes">No notes</SelectItem>
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