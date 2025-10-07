"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Download, Trash2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ERDDAPPull = {
  id: string
  startDate: string
  endDate: string
  labels: string[]
  status: "processing" | "completed" | "failed"
  progress: number
  requestedAt: Date
  estimatedSize?: string
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'processing':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Processing</Badge>
    case 'completed':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>
    case 'failed':
      return <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>
    default:
      return <Badge variant="secondary">Unknown</Badge>
  }
}

const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate).toLocaleDateString()
  const end = new Date(endDate).toLocaleDateString()
  return `${start} - ${end}`
}

export const columns: ColumnDef<ERDDAPPull>[] = [
  {
    accessorKey: "dateRange",
    header: "Date Range",
    cell: ({ row }) => {
      const startDate = row.original.startDate
      const endDate = row.original.endDate

      return (
        <div className="space-y-1">
          <div className="font-medium text-gray-900">
            {formatDateRange(startDate, endDate)}
          </div>
          <div className="text-sm text-gray-500">
            {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} days
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "labels",
    header: "Labels",
    cell: ({ row }) => {
      const labels = row.getValue("labels") as string[]

      return (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {labels.slice(0, 3).map((label) => (
            <Badge key={label} variant="outline" className="text-xs">
              {label.replace(/_/g, ' ')}
            </Badge>
          ))}
          {labels.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{labels.length - 3} more
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const progress = row.original.progress

      return (
        <div className="space-y-2">
          {getStatusBadge(status)}
          {status === 'processing' && (
            <div className="w-full">
              <Progress value={progress} className="h-2" />
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(progress)}% complete
              </div>
            </div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "estimatedSize",
    header: "Size",
    cell: ({ row }) => {
      const size = row.getValue("estimatedSize") as string | undefined

      return (
        <div className="text-sm text-gray-600">
          {size || "Calculating..."}
        </div>
      )
    },
  },
  {
    accessorKey: "requestedAt",
    header: "Requested",
    cell: ({ row }) => {
      const date = row.getValue("requestedAt") as Date

      const formatDate = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')

        return `${month}/${day}/${year} ${hours}:${minutes}`
      }

      return (
        <div className="text-sm text-gray-500">
          {formatDate(date)}
        </div>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const pull = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem disabled={pull.status !== 'completed'}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>

            <DropdownMenuItem disabled={pull.status !== 'completed'}>
              <Download className="mr-2 h-4 w-4" />
              Download Data
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Cancel/Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]