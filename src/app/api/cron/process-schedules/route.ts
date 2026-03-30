import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDay, getDate } from 'date-fns';

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

    // 4. Calculate current date metrics
    const now = new Date();
    const currentDayOfWeek = getDay(now); // 0 (Sunday) to 6 (Saturday)
    const currentDateOfMonth = getDate(now); // 1 to 31

    const assignmentsToInsert = [];
    const processedScheduleIds = [];

    // 5. Iterate schedules due for today (Hobby plans only run cron once/day)
    for (const schedule of schedules) {
      const recurrence = String(schedule.recurrence_type || '').toLowerCase();
      const weeklyDays = Array.isArray(schedule.days_of_week)
        ? schedule.days_of_week
        : (schedule.run_day_of_week !== undefined && schedule.run_day_of_week !== null
            ? [schedule.run_day_of_week]
            : []);
      const monthlyDates = Array.isArray(schedule.dates_of_month)
        ? schedule.dates_of_month
        : (schedule.run_date_of_month !== undefined && schedule.run_date_of_month !== null
            ? [schedule.run_date_of_month]
            : []);

      let isDueToday = false;
      if (recurrence === 'daily') {
        isDueToday = true;
      } else if (recurrence === 'weekly') {
        isDueToday = weeklyDays.includes(currentDayOfWeek);
      } else if (recurrence === 'monthly') {
        isDueToday = monthlyDates.includes(currentDateOfMonth);
      }

      if (!isDueToday) continue;

      const lastRun = schedule.last_run_at ? new Date(schedule.last_run_at) : null;
      const hasRunToday =
        lastRun &&
        lastRun.getFullYear() === now.getFullYear() &&
        lastRun.getMonth() === now.getMonth() &&
        lastRun.getDate() === now.getDate();

      if (hasRunToday) continue;

      let dueDate = new Date(now);
      const triggerTime = typeof schedule.trigger_time === 'string' ? schedule.trigger_time : '';
      if (triggerTime.includes(':')) {
        const [hStr, mStr] = triggerTime.split(':');
        const h = Number(hStr);
        const m = Number(mStr);
        dueDate.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
      } else {
        const h = Number.isFinite(schedule.run_hour) ? schedule.run_hour : 9;
        dueDate.setHours(h, 0, 0, 0);
      }

      assignmentsToInsert.push({
        title: schedule.title,
        description: schedule.description || '',
        priority: schedule.priority || 'Medium',
        status: 'Pending',
        due_date: dueDate.toISOString(),
        created_by_user_id: schedule.created_by_user_id || null,
      });
      processedScheduleIds.push(schedule.id);
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
