import React, { createContext, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  activeTab: string
  setActiveTab: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const context = useContext(TabsContext)
  if (!context) throw new Error('Tabs components must be used within a Tabs provider')
  return context
}

export interface TabsProps {
  defaultValue: string
  value?: string
  onChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

function Tabs({ defaultValue, value, onChange, children, className }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const activeTab = value ?? internalValue

  const setActiveTab = (newValue: string) => {
    if (!value) setInternalValue(newValue)
    onChange?.(newValue)
  }

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {}

function TabList({ className, ...props }: TabListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 border-b border-gray-200',
        className
      )}
      {...props}
    />
  )
}

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

function Tab({ value, className, children, ...props }: TabProps) {
  const { activeTab, setActiveTab } = useTabsContext()
  const isActive = activeTab === value

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={cn(
        'relative px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/20',
        isActive
          ? 'text-[#059669]'
          : 'text-gray-500 hover:text-gray-700',
        className
      )}
      {...props}
    >
      {children}
      {isActive && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#059669]" />
      )}
    </button>
  )
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

function TabPanel({ value, className, ...props }: TabPanelProps) {
  const { activeTab } = useTabsContext()
  if (activeTab !== value) return null

  return (
    <div
      role="tabpanel"
      className={cn('py-4', className)}
      {...props}
    />
  )
}

export { Tabs, TabList, Tab, TabPanel }
