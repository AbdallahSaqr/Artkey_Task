import { createClient } from './supabase/client';

export async function seedMockData() {
  const supabase = createClient();

  const mockSchedules = [
    {
      title: 'Monthly Art Audit',
      description: 'Review all artist submissions for the month.',
      priority: 'High',
      recurrence_type: 'monthly',
      trigger_time: '09:00:00',
      run_dates_of_month: [1, 15],
      is_paused: false,
    },
    {
      title: 'Weekly Artist Interview',
      description: 'Regular check-in with featured artists.',
      priority: 'Medium',
      recurrence_type: 'weekly',
      trigger_time: '14:00:00',
      run_days_of_week: [1, 3, 5],
      is_paused: false,
    },
    {
      title: 'Daily Social Media Post',
      description: 'Publish curated art content across all platforms.',
      priority: 'Low',
      recurrence_type: 'daily',
      trigger_time: '08:30:00',
      is_paused: false,
    },
    {
      title: 'Quarterly Financial Planning',
      description: 'Strategy session for upcoming exhibition budgets.',
      priority: 'High',
      recurrence_type: 'monthly',
      trigger_time: '11:00:00',
      run_dates_of_month: [5],
      is_paused: true,
    }
  ];

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const mockAssignments = [
    {
      title: 'Logo Redesign Final Review',
      description: 'Meet with branding team for final approval.',
      priority: 'High',
      status: 'In Progress',
      due_date: dateStr,
      assignee: 'Sofia Reyes',
    },
    {
      title: 'Gallery Wall Setup - East Wing',
      description: 'Coordinate with installers for the new exhibition.',
      priority: 'Medium',
      status: 'Pending',
      due_date: dateStr,
      assignee: 'Marcus Lee',
    },
    {
      title: 'Artist Contract Signing',
      description: 'Finalize digital signatures for the summer series.',
      priority: 'Low',
      status: 'Completed',
      due_date: dateStr,
      assignee: 'Aria Novak',
    },
    {
      title: 'Quarterly Sales Report',
      description: 'Prepare data for the board meeting.',
      priority: 'High',
      status: 'Overdue',
      due_date: new Date(now.setDate(now.getDate() - 2)).toISOString().split('T')[0],
      assignee: 'James Okoye',
    }
  ];

  try {
    const { error: sError } = await supabase.from('schedules').insert(mockSchedules);
    if (sError) throw sError;
    
    const { error: aError } = await supabase.from('assignments').insert(mockAssignments);
    if (aError) throw aError;

    return { success: true };
  } catch (err: any) {
    console.error('Seeding error:', err);
    throw err;
  }
}
