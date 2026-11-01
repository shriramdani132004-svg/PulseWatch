import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Pagination as PaginationType, ReportRange } from '@pulsewatch/shared';
import { REPORT_RANGE_LABELS } from '@pulsewatch/shared';
import { cn } from '@/lib/format';
import { Button } from './button';

export function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: PaginationType;
  onPageChange: (page: number) => void;
}) {
  if (pagination.total === 0) return null;
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row">
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{(pagination.page - 1) * pagination.pageSize + 1}</span>–
        <span className="font-semibold text-slate-700">
          {Math.min(pagination.page * pagination.pageSize, pagination.total)}
        </span>{' '}
        of <span className="font-semibold text-slate-700">{pagination.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
          leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
        >
          Previous
        </Button>
        <span className="min-w-20 text-center text-xs font-medium text-slate-600">
          Page {pagination.page} / {Math.max(1, pagination.totalPages)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
          rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function RangeTabs({
  value,
  onChange,
  className,
}: {
  value: ReportRange;
  onChange: (value: ReportRange) => void;
  className?: string;
}) {
  const ranges: ReportRange[] = ['24h', '7d', '30d'];
  return (
    <div className={cn('inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm', className)} role="group" aria-label="Report range">
      {ranges.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          aria-pressed={value === range}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            value === range ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
          )}
        >
          {REPORT_RANGE_LABELS[range]}
        </button>
      ))}
    </div>
  );
}
