import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDay, getDate, getHours } from 'date-fns';

export async function GET(request: Request) {
  // 1. Verify Vercel Cron Secret (Authorization Header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Instantiate Supabase Client (Preferably Service Role for executing backend tasks)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Missing Supabase environment variables.' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 3. Fetch active schedules
    const { data: schedules, error: fetchError } = await supabase
      .from('schedules')
      .select('*')
      .eq('is_paused', false);

    if (fetchError) {
      console.error('Error fetching schedules:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch active schedules.' }, { status: 500 });
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ message: 'No active schedules found at this time.', created: 0 });
    }

    // 4. Calculate current time metrics using date-fns
    const now = new Date();
    const currentHour = getHours(now);
    const currentDayOfWeek = getDay(now); // 0 (Sunday) to 6 (Saturday)
    const currentDateOfMonth = getDate(now); // 1 to 31

    const assignmentsToInsert = [];
    const processedScheduleIds = [];

    // 5. Iterate to find schedules matching the current time criteria
    for (const schedule of schedules) {
      let isMatch = false;

      // Extract expected hour structure, fallback to 0 if undefined
      const targetHour = schedule.run_hour ?? 0;

      switch (schedule.recurrence_type) {
        case 'daily':
          // Standard daily job matches if hours align
          if (targetHour === currentHour) {
            isMatch = true;
          }
          break;
        case 'weekly':
          // Must match day of the week & hour
          if (schedule.run_day_of_week === currentDayOfWeek && targetHour === currentHour) {
            isMatch = true;
          }
          break;
        case 'monthly':
          // Must match date of the month & hour
          if (schedule.run_date_of_month === currentDateOfMonth && targetHour === currentHour) {
            isMatch = true;
          }
          break;
        default:
          break;
      }

      // Check if this schedule matched the criteria AND hasn't already run in the current hour to prevent duplicates
      if (isMatch) {
        const lastRun = schedule.last_run_at ? new Date(schedule.last_run_at) : null;
        // Check if last run was less than ~1 hour ago to safeguard against rapid repeated hooks
        const hasRunRecently = lastRun && now.getTime() - lastRun.getTime() < 60 * 60 * 1000;

        if (!hasRunRecently) {
          assignmentsToInsert.push({
            title: schedule.title,
            description: schedule.description || '',
            priority: schedule.priority || 'Medium',
            status: 'Pending',
            // Assign dummy 7 days due date, should be handled correctly by application logic depending on schedule specifications
            due_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), 
          });
          processedScheduleIds.push(schedule.id);
        }
      }
    }

    let createdCount = 0;

    // Execute bulk insert and updates
    if (assignmentsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('assignments')
        .insert(assignmentsToInsert);

      if (insertError) {
        console.error('Error inserting assignments:', insertError);
        return NextResponse.json({ error: 'Failed to create assignments.' }, { status: 500 });
      }

      createdCount = assignmentsToInsert.length;

      // 6. Update last_run_at on processed schedules to avoid duplicate task creation
      const { error: updateError } = await supabase
        .from('schedules')
        .update({ last_run_at: now.toISOString() })
        .in('id', processedScheduleIds);

      if (updateError) {
        console.error('Error updating schedules last_run_at state:', updateError);
      }
    }

    // 7. Return detailed JSON response
    return NextResponse.json({
      success: true,
      processed_schedules: processedScheduleIds.length,
      assignments_created: createdCount,
      message: `Cron job executed successfully. Created ${createdCount} assignments.`,
    });
  } catch (error: any) {
    console.error('Unexpected error in cron handler:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error during execution.' },
      { status: 500 }
    );
  }
}
