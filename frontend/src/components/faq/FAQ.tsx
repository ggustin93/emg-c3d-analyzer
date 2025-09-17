import React, { useState, useMemo, useDeferredValue } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Accordion } from '../ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Badge } from '../ui/badge'
import { FAQSearch } from './FAQSearch'
import { FAQItem } from './FAQItem'
import { loadAllFAQs, searchFAQs, filterFAQsByRole } from './loadFAQContent'
import { faqCategories } from './faqData'
import { QuestionMarkCircledIcon, InfoCircledIcon } from '@radix-ui/react-icons'
import { useAuth } from '../../contexts/AuthContext'

export function FAQ() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const { userRole } = useAuth()
  
  // Use deferred value for search to improve performance
  const deferredSearchTerm = useDeferredValue(searchTerm)
  
  // Load all FAQs from markdown files
  const allFAQs = useMemo(() => loadAllFAQs(), [])
  
  // Map auth role to FAQ role format
  const currentUserRole = useMemo(() => {
    switch(userRole?.toLowerCase()) {
      case 'therapist': return 'therapist'
      case 'researcher': return 'researcher'
      case 'admin': return 'admin'
      default: return 'all'
    }
  }, [userRole])
  
  // Filter FAQ items based on search, category, and user role
  const filteredFAQs = useMemo(() => {
    // Start with role-filtered FAQs
    let items = filterFAQsByRole(allFAQs, currentUserRole)
    
    // Apply search filter
    if (deferredSearchTerm) {
      items = searchFAQs(items, deferredSearchTerm)
    }
    
    // Apply category filter
    if (selectedCategory !== 'all') {
      items = items.filter(item => item.category === selectedCategory)
    }
    
    return items
  }, [allFAQs, deferredSearchTerm, selectedCategory, currentUserRole])
  
  // Count items per category for badges (filtered by role)
  const categoryCounts = useMemo(() => {
    const roleFilteredItems = filterFAQsByRole(allFAQs, currentUserRole)
    
    const counts: Record<string, number> = { all: roleFilteredItems.length }
    faqCategories.forEach(category => {
      counts[category.id] = roleFilteredItems.filter(item => 
        item.category === category.id
      ).length
    })
    return counts
  }, [allFAQs, currentUserRole])
  
  return (
    <div className="p-6 space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <QuestionMarkCircledIcon className="h-6 w-6 text-blue-500" />
            <CardTitle className="text-2xl">Frequently Asked Questions</CardTitle>
          </div>
          <CardDescription className="mt-2">
            Find answers to common questions about the EMG C3D Analyzer platform. 
            Use the search bar or browse by category to find what you're looking for.
          </CardDescription>
          <div className="mt-2">
          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mt-2 rounded-r">
            <p className="text-blue-900 text-md">Note: This section is currently under development. The content provided is for demonstration and preview purposes as we continue to enhance this feature.</p>
          </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <FAQSearch 
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search for keywords, questions, or topics..."
            />
            
            {/* Category Tabs */}
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
                <TabsTrigger value="all" className="text-xs">
                  All <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">
                    {categoryCounts.all}
                  </Badge>
                </TabsTrigger>
                {faqCategories.map(category => (
                  <TabsTrigger key={category.id} value={category.id} className="text-xs">
                    {category.label.split(' ')[0]}
                    <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">
                      {categoryCounts[category.id]}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>
      
      {/* FAQ Items */}
      <Card>
        <CardContent className="pt-6">
          {filteredFAQs.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {deferredSearchTerm 
                    ? `Found ${filteredFAQs.length} result${filteredFAQs.length !== 1 ? 's' : ''} for "${deferredSearchTerm}"`
                    : selectedCategory !== 'all'
                    ? faqCategories.find(c => c.id === selectedCategory)?.description
                    : 'Browse all frequently asked questions'
                  }
                </h3>
                {deferredSearchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
              
              <Accordion type="single" collapsible className="w-full">
                {filteredFAQs.map((faq) => (
                  <FAQItem key={faq.id} item={faq} value={faq.id} />
                ))}
              </Accordion>
            </>
          ) : (
            <div className="text-center py-12">
              <InfoCircledIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No results found</h3>
              <p className="text-muted-foreground">
                {deferredSearchTerm 
                  ? `Try searching with different keywords or browse all categories`
                  : 'No FAQ items available in this category'
                }
              </p>
              {deferredSearchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-primary hover:underline text-sm"
                >
                  Clear search and show all
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Help Footer */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <h3 className="font-medium">Still need help?</h3>
            <p className="text-sm text-muted-foreground">
              If you can't find the answer you're looking for, please contact your system administrator
              or refer to the user manual for detailed documentation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}