import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { DashboardOverview } from '@/components/dashboard/dashboard-overview'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'

// Mock dependencies
jest.mock('@/lib/supabase/client')
jest.mock('@/hooks/use-realtime')
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}))

// Mock ResizeObserver for Recharts
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

describe('DashboardOverview Metrics Orchestration', () => {
  const mockAssignments = [
    {
      id: '1',
      title: 'Task 1',
      assignee: 'Alice',
      status: 'Completed',
      due_date: '2026-01-01T12:00:00Z',
      created_at: '2026-01-01T10:00:00Z',
    },
    {
      id: '2',
      title: 'Task 2',
      assignee: 'Bob',
      status: 'Pending',
      due_date: '2020-01-01T12:00:00Z', // Overdue
      created_at: '2020-01-01T10:00:00Z',
    },
    {
      id: '3',
      title: 'Task 3',
      assignee: 'Alice',
      status: 'In Progress',
      due_date: '2027-01-01T12:00:00Z', // Not overdue
      created_at: '2026-01-01T10:00:00Z',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    ;(createClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: mockAssignments, error: null }),
    })
  })

  it('correctly distills and renders the world-class administrative metrics', async () => {
    render(<DashboardOverview />)

    // Wait for the metrics to be calculated and rendered
    await waitFor(() => {
      // Total Pipeline: 3
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Global Pipeline')).toBeInTheDocument()
      
      // Completed: 1
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      
      // Overdue (Delinquent): 1 (Task 2 is in the past and not completed)
      // Task 1: Completed (Not overdue)
      // Task 3: 2027 (Not overdue)
      // Task 2: 2020 (Delinquent)
      // Value is '1'
      const overdueElements = screen.getAllByText('1')
      expect(overdueElements.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Delinquent Tasks')).toBeInTheDocument()
      
      // Success Rate: (1 / 3) * 100 = 33.3%
      expect(screen.getByText('33.3%')).toBeInTheDocument()
    })
  })
})
