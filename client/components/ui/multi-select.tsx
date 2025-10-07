"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface MultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  className,
}: MultiSelectProps) {
  const handleSelect = (value: string) => {
    if (!selected.includes(value)) {
      onChange([...selected, value])
    }
  }

  const handleRemove = (value: string) => {
    onChange(selected.filter((item) => item !== value))
  }

  const availableOptions = options.filter((option) => !selected.includes(option))

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2 mb-2">
        {selected.map((item) => (
          <Badge key={item} variant="secondary" className="text-sm">
            {item}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 ml-2 hover:bg-transparent"
              onClick={() => handleRemove(item)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>

      {availableOptions.length > 0 && (
        <Select onValueChange={handleSelect}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {availableOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}