import React from 'react'
import { Input } from '../ui/input'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'

interface FAQSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function FAQSearch({ value, onChange, placeholder = "Search FAQ..." }: FAQSearchProps) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        <MagnifyingGlassIcon className="h-4 w-4" />
      </div>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-4"
      />
    </div>
  )
}