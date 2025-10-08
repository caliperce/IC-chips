/**
 * Beautiful Table Component for Streamed Tables
 * 
 * This component takes parsed table data from the frontend-stream-parser
 * and renders it as a beautiful, styled table.
 */

import React from 'react';

interface StreamedTableProps {
  headers: string[];
  rows: string[][];
  className?: string;
}

export function StreamedTable({ headers, rows, className = '' }: StreamedTableProps) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-gray-700 my-4 ${className}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-800 border-b border-gray-700">
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-4 py-3 text-left text-sm font-semibold text-white"
              >
                {/* Remove markdown bold syntax if present */}
                {header.replace(/\*\*/g, '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`
                border-b border-gray-800 
                hover:bg-gray-800/50 
                transition-colors
                ${rowIndex % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/50'}
              `}
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-4 py-3 text-sm text-gray-300"
                >
                  {/* Remove markdown bold syntax if present */}
                  {cell.replace(/\*\*/g, '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Alternative Compact Table Style
 */
export function CompactStreamedTable({ headers, rows, className = '' }: StreamedTableProps) {
  return (
    <div className={`overflow-x-auto my-3 ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-700">
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-3 py-2 text-left font-medium text-white"
              >
                {header.replace(/\*\*/g, '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-gray-800"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-3 py-2 text-gray-300"
                >
                  {cell.replace(/\*\*/g, '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Card-Style Table (Great for mobile!)
 */
export function CardStreamedTable({ headers, rows, className = '' }: StreamedTableProps) {
  return (
    <div className={`space-y-3 my-4 ${className}`}>
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
        >
          {row.map((cell, cellIndex) => (
            <div key={cellIndex} className="mb-2 last:mb-0">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                {headers[cellIndex]?.replace(/\*\*/g, '')}
              </span>
              <span className="text-sm text-gray-200">
                {cell.replace(/\*\*/g, '')}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Example usage in your chat component:
 * 
 * import { StreamedTable, CompactStreamedTable, CardStreamedTable } from './StreamedTable';
 * 
 * // In your component where you use FrontendStreamParser:
 * const [tables, setTables] = useState([]);
 * 
 * const parser = new FrontendStreamParser({
 *   onTableDetected: (table, allTables) => {
 *     setTables(allTables);
 *   }
 * });
 * 
 * // Then render:
 * {tables.map((table, index) => (
 *   <StreamedTable 
 *     key={index}
 *     headers={table.headers}
 *     rows={table.rows}
 *   />
 * ))}
 */
