import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-700',
        success: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
        warning: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
        danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
        info: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
