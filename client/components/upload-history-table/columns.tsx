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

export type UploadHistoryItem = {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  status: "uploading" | "completed" | "failed"
  progress: number
  uploadedAt: Date
}

const getFileTypeIcon = (fileType: string) => {
  switch (fileType.toLowerCase()) {
    case 'csv':
      return '📊'
    case 'netcdf':
    case 'nc':
      return '🌊'
    case 'parquet':
      return '📈'
    default:
      return '📄'
  }
}

const getFileTypeBadge = (fileType: string) => {
  switch (fileType.toLowerCase()) {
    case 'csv':
      return <Badge className="bg-green-100 text-green-800 border-green-200">CSV</Badge>
    case 'netcdf':
    case 'nc':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">NetCDF</Badge>
    case 'parquet':
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Parquet</Badge>
    default:
      return <Badge variant="secondary">{fileType.toUpperCase()}</Badge>
  }
}

const getStatusBadge = (status: string, progress: number) => {
  switch (status) {
    case 'uploading':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Uploading</Badge>
    case 'completed':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>
    case 'failed':
      return <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>
    default:
      return <Badge variant="secondary">Unknown</Badge>
  }
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const columns: ColumnDef<UploadHistoryItem>[] = [
  {
    accessorKey: "fileName",
    header: "File Name",
    cell: ({ row }) => {
      const fileName = row.getValue("fileName") as string
      const fileType = row.original.fileType

      return (
        <div className="flex items-center space-x-3">
          <span className="text-xl">{getFileTypeIcon(fileType)}</span>
          <div>
            <div className="font-medium text-gray-900">{fileName}</div>
            <div className="text-sm text-gray-500">
              {formatFileSize(row.original.fileSize)}
            </div>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "fileType",
    header: "Type",
    cell: ({ row }) => {
      const fileType = row.getValue("fileType") as string
      return getFileTypeBadge(fileType)
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
          {getStatusBadge(status, progress)}
          {status === 'uploading' && (
            <div className="w-full">
              <Progress value={progress} className="h-2" />
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(progress)}%
              </div>
            </div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "uploadedAt",
    header: "Uploaded",
    cell: ({ row }) => {
      const date = row.getValue("uploadedAt") as Date

      // Use consistent formatting to avoid hydration issues
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
      const file = row.original

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

            <DropdownMenuItem disabled={file.status !== 'completed'}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>

            <DropdownMenuItem disabled={file.status !== 'completed'}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]