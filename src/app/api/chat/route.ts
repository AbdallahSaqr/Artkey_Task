import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ intent: 'reply', response: "You must be logged in to use the AI assistant." });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    const userRole = profile?.role || 'Member';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured in the environment.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    console.log(`API check: Using key starting with ${apiKey.substring(0, 4)}...`);
    
    const { message, history } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'A valid message string is required.' },
        { status: 400 }
      );
    }

    function isCapabilitiesRequest(input: string) {
      const text = input.toLowerCase().trim();
      return (
        /what\s+can\s+you\s+do/.test(text) ||
        /help/.test(text) ||
        /capabilit(y|ies)/.test(text) ||
        /list\s+(your\s+)?commands/.test(text) ||
        /show\s+(me\s+)?(commands|features)/.test(text)
      );
    }

    if (isCapabilitiesRequest(message)) {
      return NextResponse.json({
        intent: 'reply',
        response: 'Here is what I can help you with:',
        capabilities: [
          'Create a new assignment with title, description, due date/time, and priority.',
          'Create recurring schedules (daily, weekly, monthly).',
          'Edit assignments: title, priority, and status (Pending, In Progress, Completed, Overdue).',
          'Mark assignments as completed.',
          'Delete assignments (single match or bulk by due period).',
          'Delete schedules.',
          'Edit schedules: title, priority, and trigger time.',
          'Pause or resume schedules.',
          'Fetch assignments or schedules for today, this week, this month, or all.',
          'Handle fuzzy title matching and ask for clarification when multiple close matches exist.',
        ],
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const systemInstruction = `System: You are an AI assistant for an Assignment Management Dashboard. Today's date is ${today}.
    
The current user's role is ${userRole}. Only Admins can create templates.

You must extract the user's intent from the conversation and respond strictly in valid JSON format matching ONLY ONE of these structures:

1. Create a single assignment:
{ "intent": "create_task", "title": "string", "description": "string", "due_date": "YYYY-MM-DD", "trigger_time": "HH:MM", "priority": "Low" | "Medium" | "High" }

2. Create a recurring schedule:
{ "intent": "create_schedule", "title": "string", "description": "string", "recurrence_type": "Daily" | "Weekly" | "Monthly", "trigger_time": "HH:MM", "priority": "Medium" }

3. Create a template (ADMIN ONLY):
{ "intent": "create_template", "title": "string", "description": "string", "priority": "Medium" }

4. Edit an existing assignment:
{ "intent": "edit_assignment", "target_title": "search keyword", "new_title": "string (optional)", "new_priority": "Medium (optional)", "new_status": "Pending" | "In Progress" | "Completed" | "Overdue" (optional) }

5. Mark an assignment as completed:
{ "intent": "complete_assignment", "target_title": "search keyword" }

6. Delete an assignment:
{ "intent": "delete_assignment", "target_title": "search keyword" }

7. Delete a schedule:
{ "intent": "delete_schedule", "target_title": "search keyword" }

8. Edit a schedule:
{ "intent": "edit_schedule", "target_title": "search keyword", "new_title": "string (optional)", "new_priority": "Low" | "Medium" | "High" (optional), "new_trigger_time": "HH:MM" (optional) }

9. Pause a schedule:
{ "intent": "pause_schedule", "target_title": "search keyword" }

10. Resume a schedule:
{ "intent": "resume_schedule", "target_title": "search keyword" }

11. Fetch data (assignments or schedules):
{ "intent": "fetch_data", "target": "assignments" | "schedules", "timeframe": "today" | "week" | "month" | "all", "specific_date": "YYYY-MM-DD" (optional) }

12. Conversational reply or asking for missing info:
{ "intent": "reply", "response": "Your conversational text here" }

13. Delete multiple assignments by period:
{ "intent": "delete_bulk_assignments", "timeframe": "today" | "week" | "month" }

Rules:
- NEVER use markdown blocks in the output. Just raw JSON.
- If the user asks for their assignments/schedules today, this week, this month, or a specific day, return fetch_data.
- If you lack critical info (e.g., no title for a task), return a reply intent asking for it.
- Default time is 09:00. Default priority is Medium.
`;

    let conversationContext = '';
    if (Array.isArray(history) && history.length > 0) {
      conversationContext = history
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');
      conversationContext += '\n';
    }
    const prompt = `${systemInstruction}\n\nConversation so far:\n${conversationContext}User: ${message}`;

    const models = ['gemini-3.1-flash-lite-preview', 'gemini-1.5-flash'];
    let result;
    let lastError: any;

    const queryGemini = async (inputPrompt: string) => {
      for (const modelName of models) {
        try {
          const currentModel = genAI.getGenerativeModel({ model: modelName });
          const res = await currentModel.generateContent(inputPrompt);
          return res.response.text();
        } catch (e: any) {
          lastError = e;
          if (e.message?.includes('404') || e.message?.includes('429')) continue;
          throw e;
        }
      }
      throw lastError;
    };

    const responseText = await queryGemini(prompt);
    let parsedJSON: any = null;
    
    try {
      const cleanJSONString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedJSON = JSON.parse(cleanJSONString);
    } catch (e) {
      // Fallback
      return NextResponse.json({ intent: 'reply', response: responseText });
    }

    if (!parsedJSON || !parsedJSON.intent) {
      return NextResponse.json({ intent: 'reply', response: "I'm not sure how to process that command." });
    }

    if (parsedJSON.intent === 'reply') {
      const inferred = inferCompleteIntentFromMessage(message);
      if (inferred) {
        parsedJSON = inferred;
      }
    }

    console.log("AI Intent parsed:", parsedJSON.intent);

    function normalize(value: string) {
      return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function normalizeAssignmentStatus(input: string | undefined): 'Pending' | 'In Progress' | 'Completed' | 'Overdue' | null {
      if (!input) return null;
      const text = normalize(input);
      if (!text) return null;

      if (text.includes('complete') || text === 'done' || text.includes('finish')) return 'Completed';
      if (text.includes('in progress') || text.includes('progress') || text.includes('ongoing') || text.includes('working')) return 'In Progress';
      if (text.includes('overdue') || text.includes('late')) return 'Overdue';
      if (text.includes('pending') || text.includes('todo') || text.includes('to do') || text.includes('open')) return 'Pending';

      return null;
    }

    function inferCompleteIntentFromMessage(input: string): { intent: 'complete_assignment'; target_title: string } | null {
      const lower = normalize(input);
      if (!lower) return null;

      const completeVerb = lower.includes('complete') || lower.includes('completed') || lower.includes('mark') || lower.includes('finish');
      if (!completeVerb) return null;

      const titled = input.match(/(?:assignment|task)\s+["']?([^"']+?)["']?\s*(?:as|to)?\s*completed?/i);
      if (titled && titled[1]) {
        return { intent: 'complete_assignment', target_title: titled[1].trim() };
      }

      const quoted = input.match(/["']([^"']+)["']/);
      if (quoted && quoted[1] && !normalize(quoted[1]).includes('status')) {
        return { intent: 'complete_assignment', target_title: quoted[1].trim() };
      }

      return null;
    }

    function normalizeSchedulePriority(input: string | undefined): 'Low' | 'Medium' | 'High' | null {
      if (!input) return null;
      const text = normalize(input);
      if (text.includes('high')) return 'High';
      if (text.includes('low')) return 'Low';
      if (text.includes('medium') || text.includes('normal') || text.includes('default')) return 'Medium';
      return null;
    }

    function normalizeTriggerTime(input: string | undefined): string | null {
      if (!input) return null;
      const raw = String(input).trim();
      if (!raw) return null;

      const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/);
      if (hhmm) {
        const hour = Number(hhmm[1]);
        const minute = Number(hhmm[2]);
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
          return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
        }
      }

      const ampm = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
      if (ampm) {
        let hour = Number(ampm[1]);
        const minute = Number(ampm[2] || '0');
        const meridiem = ampm[3].toLowerCase();

        if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
          return null;
        }

        if (meridiem === 'pm' && hour !== 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;

        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
      }

      return null;
    }

    function inferRelativeScheduleTimeFromMessage(input: string, currentTriggerTime: string | undefined): string | null {
      if (!currentTriggerTime) return null;

      const baseMatch = String(currentTriggerTime).match(/^(\d{2}):(\d{2})/);
      if (!baseMatch) return null;

      const baseMinutes = Number(baseMatch[1]) * 60 + Number(baseMatch[2]);
      const text = normalize(input);
      if (!text) return null;

      let direction = 0;
      if (text.includes('later') || text.includes('delay') || text.includes('postpone') || text.includes('push')) {
        direction = 1;
      } else if (text.includes('earlier') || text.includes('advance') || text.includes('bring forward')) {
        direction = -1;
      }

      if (direction === 0) return null;

      const minuteMatch = text.match(/(\d+)\s*(minute|min|mins|minutes)/);
      const hourMatch = text.match(/(\d+)\s*(hour|hr|hrs|hours)/);

      let deltaMinutes = 0;
      if (hourMatch) {
        deltaMinutes += Number(hourMatch[1]) * 60;
      }
      if (minuteMatch) {
        deltaMinutes += Number(minuteMatch[1]);
      }

      if (deltaMinutes === 0) {
        if (text.includes('half an hour') || text.includes('half-hour') || text.includes('half hour')) {
          deltaMinutes = 30;
        } else if (text.includes('an hour') || text.includes('one hour')) {
          deltaMinutes = 60;
        } else {
          return null;
        }
      }

      let adjusted = baseMinutes + direction * deltaMinutes;
      while (adjusted < 0) adjusted += 24 * 60;
      while (adjusted >= 24 * 60) adjusted -= 24 * 60;

      const hour = Math.floor(adjusted / 60);
      const minute = adjusted % 60;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    }

    async function getAccessibleAssignmentCandidates() {
      if (userRole === 'Admin') {
        const { data, error } = await supabase
          .from('assignments')
          .select('id, title, due_date')
          .order('created_at', { ascending: false })
          .limit(200);

        return { data: data || [], error };
      }

      const { data: linkRows, error: linkError } = await supabase
        .from('assignment_assignees')
        .select('assignment_id')
        .eq('user_id', user.id);

      if (linkError) {
        return { data: [], error: linkError };
      }

      const assignmentIds = (linkRows || []).map((row: { assignment_id: string }) => row.assignment_id);
      if (assignmentIds.length === 0) {
        return { data: [], error: null };
      }

      const { data, error } = await supabase
        .from('assignments')
        .select('id, title, due_date')
        .in('id', assignmentIds)
        .order('created_at', { ascending: false })
        .limit(200);

      return { data: data || [], error };
    }

    async function getAccessibleScheduleCandidates() {
      if (userRole === 'Admin') {
        const { data, error } = await supabase
          .from('schedules')
          .select('id, title, is_paused')
          .order('created_at', { ascending: false })
          .limit(200);

        return { data: data || [], error };
      }

      const { data: linkRows, error: linkError } = await supabase
        .from('schedule_assignees')
        .select('schedule_id')
        .eq('user_id', user.id);

      if (linkError) {
        return { data: [], error: linkError };
      }

      const scheduleIds = (linkRows || []).map((row: { schedule_id: string }) => row.schedule_id);
      if (scheduleIds.length === 0) {
        return { data: [], error: null };
      }

      const { data, error } = await supabase
        .from('schedules')
        .select('id, title, is_paused')
        .in('id', scheduleIds)
        .order('created_at', { ascending: false })
        .limit(200);

      return { data: data || [], error };
    }

    function getScoredAssignmentMatches(
      targetTitle: string,
      candidates: Array<{ id: string; title: string }>
    ) {
      const targetNorm = normalize(targetTitle);
      if (!targetNorm) return [] as Array<{ candidate: { id: string; title: string }; score: number }>;

      const targetTokens = targetNorm.split(' ').filter(Boolean);
      const scored = candidates
        .map((candidate) => {
          const titleNorm = normalize(candidate.title || '');
          if (!titleNorm) {
            return { candidate, score: 0 };
          }

          let score = 0;

          if (titleNorm === targetNorm) {
            score += 100;
          }

          if (titleNorm.includes(targetNorm)) {
            score += 70;
          }

          if (targetNorm.includes(titleNorm) && titleNorm.length >= 4) {
            score += 45;
          }

          const titleTokens = new Set(titleNorm.split(' ').filter(Boolean));
          const matchedTokenCount = targetTokens.filter((token) => titleTokens.has(token)).length;

          if (targetTokens.length > 0) {
            score += (matchedTokenCount / targetTokens.length) * 40;
          }

          if (matchedTokenCount === targetTokens.length && targetTokens.length > 1) {
            score += 20;
          }

          return { candidate, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      return scored;
    }

    function getAmbiguityMessage(matches: Array<{ candidate: { id: string; title: string }; score: number }>) {
      const options = matches
        .slice(0, 3)
        .map((m, index) => `${index + 1}. ${m.candidate.title}`)
        .join(' | ');

      return `I found multiple close matches. Which one do you mean? ${options}`;
    }

    function extractBulkTimeframe(input: string): 'today' | 'week' | 'month' | null {
      const text = normalize(input);
      if (!text) return null;

      if (text.includes('today') || text.includes('due today')) return 'today';
      if (text.includes('this week') || text.includes('week')) return 'week';
      if (text.includes('this month') || text.includes('month')) return 'month';
      return null;
    }

    function isAllReference(input: string): boolean {
      const text = normalize(input);
      return text === 'all' || text === 'all of them' || text === 'them' || text === 'all tasks' || text === 'all assignments';
    }

    function extractAmbiguityOptionsFromHistory(
      chatHistory: Array<{ role: string; content: string }>
    ): string[] {
      for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
        const entry = chatHistory[i];
        if (entry.role !== 'assistant') continue;

        const content = entry.content || '';
        if (!content.toLowerCase().includes('which one do you mean?')) continue;

        const matches = Array.from(content.matchAll(/\d+\.\s([^|]+)/g)).map((m) => m[1].trim());
        if (matches.length > 0) return matches;
      }

      return [];
    }

    function withinTimeframe(dueDate: string | null | undefined, timeframe: 'today' | 'week' | 'month'): boolean {
      if (!dueDate) return false;
      const due = new Date(dueDate);
      if (Number.isNaN(due.getTime())) return false;

      const now = new Date();

      if (timeframe === 'today') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return due >= start && due <= end;
      }

      if (timeframe === 'week') {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return due >= start && due <= end;
      }

      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return due >= start && due <= end;
    }

    async function deleteAssignmentsByIds(rows: Array<{ id: string; title: string }>) {
      const ids = Array.from(new Set(rows.map((row) => row.id)));
      if (ids.length === 0) {
        return { deletedCount: 0, error: null as null | { message: string } };
      }

      const { error } = await supabase.from('assignments').delete().in('id', ids);
      return { deletedCount: ids.length, error };
    }

    async function handleBulkDelete(timeframe: 'today' | 'week' | 'month') {
      const { data: candidates, error: candidateError } = await getAccessibleAssignmentCandidates();
      if (candidateError) {
        return NextResponse.json({ intent: 'reply', response: 'I hit a database error while searching assignments.' });
      }

      const scoped = (candidates || []).filter((row: { due_date?: string | null }) => withinTimeframe(row.due_date, timeframe));
      if (scoped.length === 0) {
        const label = timeframe === 'today' ? 'today' : timeframe === 'week' ? 'this week' : 'this month';
        return NextResponse.json({ intent: 'reply', response: `I could not find any assignments due ${label}.` });
      }

      const { deletedCount, error } = await deleteAssignmentsByIds(scoped as Array<{ id: string; title: string }>);
      if (error) {
        return NextResponse.json({ intent: 'reply', response: 'There was an error while deleting assignments.' });
      }

      const label = timeframe === 'today' ? 'today' : timeframe === 'week' ? 'this week' : 'this month';
      return NextResponse.json({ intent: 'reply', response: `I deleted ${deletedCount} assignment${deletedCount === 1 ? '' : 's'} due ${label}.`, action: { entity: 'assignment', operation: 'delete', count: deletedCount } });
    }

    // Backend Intercepts:
    if (parsedJSON.intent === 'fetch_data') {
      const { target, timeframe, specific_date } = parsedJSON;
      let query = supabase.from(target === 'schedules' ? 'schedules' : 'assignments').select('*');
      
      // We only fetch for the current user to respect privacy
      query = query.eq('created_by', user.id);

      if (target === 'assignments') {
         if (timeframe === 'today' || specific_date) {
            const dateStr = specific_date || today;
            query = query.gte('due_date', `${dateStr}T00:00:00Z`).lte('due_date', `${dateStr}T23:59:59Z`);
         } else if (timeframe === 'week') {
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            query = query.gte('due_date', startOfWeek.toISOString()).lte('due_date', endOfWeek.toISOString());
         } else if (timeframe === 'month') {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
            query = query.gte('due_date', startOfMonth.toISOString()).lte('due_date', endOfMonth.toISOString());
         }
      }

      const { data, error } = await query;
      if (error) {
         return NextResponse.json({ intent: 'reply', response: "I encountered a database error while fetching data." });
      }

      const normalizedTimeframe = (timeframe || 'all') as 'today' | 'week' | 'month' | 'all';
      const rows = data || [];

      if (target === 'assignments') {
        const items = rows
          .map((row: any) => ({
            id: row.id,
            title: row.title,
            priority: row.priority,
            status: row.status,
            due_date: row.due_date,
          }))
          .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

        const label = normalizedTimeframe === 'all' ? 'all assignments' : `assignments due ${normalizedTimeframe === 'week' ? 'this week' : normalizedTimeframe === 'month' ? 'this month' : 'today'}`;
        const response = items.length > 0
          ? `Here are your ${label}:`
          : `You have no ${label}.`;

        return NextResponse.json({
          intent: 'reply',
          response,
          data_view: {
            type: 'assignments',
            timeframe: normalizedTimeframe,
            items,
          },
        });
      }

      const scheduleItems = rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        priority: row.priority,
        recurrence_type: row.recurrence_type,
        trigger_time: row.trigger_time,
        is_paused: row.is_paused,
      }));

      const label = normalizedTimeframe === 'all' ? 'all schedules' : `schedules for ${normalizedTimeframe === 'week' ? 'this week' : normalizedTimeframe === 'month' ? 'this month' : 'today'}`;
      const response = scheduleItems.length > 0
        ? `Here are your ${label}:`
        : `You have no ${label}.`;

      return NextResponse.json({
        intent: 'reply',
        response,
        data_view: {
          type: 'schedules',
          timeframe: normalizedTimeframe,
          items: scheduleItems,
        },
      });
    }

    if (parsedJSON.intent === 'create_template') {
       if (userRole !== 'Admin') {
          return NextResponse.json({ intent: 'reply', response: "Sorry, only administrators can create templates." });
       }
       const { title, description, priority } = parsedJSON;
       if (!title) return NextResponse.json({ intent: 'reply', response: "Please provide a title for the template." });

       const { error } = await supabase.from('assignment_templates').insert({
          title, description: description || '', priority: priority || 'Medium', created_by: user.id
       });

       if (error) return NextResponse.json({ intent: 'reply', response: `Failed to create template: ${error.message}` });
      return NextResponse.json({ intent: 'reply', response: `I have successfully created the template "${title}".`, action: { entity: 'template', operation: 'create', count: 1 } });
    }

    if (parsedJSON.intent === 'delete_bulk_assignments') {
      const timeframe = parsedJSON.timeframe as 'today' | 'week' | 'month' | undefined;
      if (!timeframe || !['today', 'week', 'month'].includes(timeframe)) {
        return NextResponse.json({ intent: 'reply', response: 'Tell me whether to delete assignments due today, this week, or this month.' });
      }

      return handleBulkDelete(timeframe);
    }

    if (parsedJSON.intent === 'complete_assignment') {
      const { target_title } = parsedJSON;
      if (!target_title) {
        return NextResponse.json({ intent: 'reply', response: 'Which assignment should I mark as completed?' });
      }

      parsedJSON = {
        intent: 'edit_assignment',
        target_title,
        new_status: 'Completed',
      };
    }

    if (parsedJSON.intent === 'delete_assignment') {
       const { target_title } = parsedJSON;
       if (!target_title) return NextResponse.json({ intent: 'reply', response: "Which assignment do you want me to delete?" });

       const directTimeframe = extractBulkTimeframe(message) || extractBulkTimeframe(target_title);
       if (directTimeframe && (normalize(message).includes('delete') || normalize(message).includes('remove'))) {
         return handleBulkDelete(directTimeframe);
       }

       if (isAllReference(target_title) || isAllReference(message)) {
         const historyItems = Array.isArray(history) ? history : [];
         const lastTimeframe = [...historyItems]
           .reverse()
           .map((item: { role: string; content: string }) => (item.role === 'user' ? extractBulkTimeframe(item.content || '') : null))
           .find((value: 'today' | 'week' | 'month' | null) => value !== null);

         if (lastTimeframe) {
           return handleBulkDelete(lastTimeframe);
         }

         const ambiguityOptions = extractAmbiguityOptionsFromHistory(historyItems as Array<{ role: string; content: string }>);
         if (ambiguityOptions.length > 0) {
           const { data: candidates, error: candidateError } = await getAccessibleAssignmentCandidates();
           if (candidateError) {
             return NextResponse.json({ intent: 'reply', response: 'I hit a database error while searching assignments.' });
           }

           const optionSet = new Set(ambiguityOptions.map((option) => normalize(option)));
           const toDelete = (candidates || []).filter((row: { title: string }) => optionSet.has(normalize(row.title)));
           if (toDelete.length === 0) {
             return NextResponse.json({ intent: 'reply', response: 'I could not resolve which assignments to delete. Please restate the titles.' });
           }

           const { deletedCount, error } = await deleteAssignmentsByIds(toDelete as Array<{ id: string; title: string }>);
           if (error) {
             return NextResponse.json({ intent: 'reply', response: 'There was an error while deleting assignments.' });
           }

           return NextResponse.json({ intent: 'reply', response: `I deleted ${deletedCount} assignment${deletedCount === 1 ? '' : 's'} from those options.`, action: { entity: 'assignment', operation: 'delete', count: deletedCount } });
         }
       }

       const { data: candidates, error: candidateError } = await getAccessibleAssignmentCandidates();
       if (candidateError) {
         return NextResponse.json({ intent: 'reply', response: "I hit a database error while searching assignments." });
       }

       const scoredMatches = getScoredAssignmentMatches(target_title, candidates as Array<{ id: string; title: string }>);
       if (scoredMatches.length === 0) {
         const { data: scheduleCandidates, error: scheduleError } = await getAccessibleScheduleCandidates();
         if (scheduleError) {
           return NextResponse.json({ intent: 'reply', response: "I hit a database error while searching schedules." });
         }

         const scheduleMatches = getScoredAssignmentMatches(target_title, scheduleCandidates as Array<{ id: string; title: string }>);
         if (scheduleMatches.length > 0) {
           if (scheduleMatches.length > 1) {
             const top = scheduleMatches[0];
             const runnerUp = scheduleMatches[1];
             const scoreGap = top.score - runnerUp.score;
             if (scoreGap < 12) {
               return NextResponse.json({ intent: 'reply', response: getAmbiguityMessage(scheduleMatches) });
             }
           }

           const scheduleMatch = scheduleMatches[0].candidate;
           const { error } = await supabase.from('schedules').delete().eq('id', scheduleMatch.id);
           if (error) {
             return NextResponse.json({ intent: 'reply', response: "There was an error while deleting the schedule." });
           }

           return NextResponse.json({ intent: 'reply', response: `I have deleted the schedule "${scheduleMatch.title}".`, action: { entity: 'schedule', operation: 'delete', count: 1 } });
         }

         const assignmentPreview = (candidates || []).slice(0, 3).map((row: { title: string }) => `"${row.title}"`).join(', ');
         const schedulePreview = (scheduleCandidates || []).slice(0, 2).map((row: { title: string }) => `"${row.title}"`).join(', ');
         const previewParts = [
           assignmentPreview ? `Assignments: ${assignmentPreview}` : '',
           schedulePreview ? `Schedules: ${schedulePreview}` : '',
         ].filter(Boolean).join(' | ');
         const suffix = previewParts ? ` I found these instead: ${previewParts}.` : '';
         return NextResponse.json({ intent: 'reply', response: `I could not find a matching assignment or schedule for "${target_title}".${suffix}` });
       }

       if (scoredMatches.length > 1) {
         const top = scoredMatches[0];
         const runnerUp = scoredMatches[1];
         const scoreGap = top.score - runnerUp.score;
         if (scoreGap < 12) {
           return NextResponse.json({ intent: 'reply', response: getAmbiguityMessage(scoredMatches) });
         }
       }

       const match = scoredMatches[0].candidate;
       
       const { error } = await supabase.from('assignments').delete().eq('id', match.id);
       if (error) return NextResponse.json({ intent: 'reply', response: "There was an error while deleting the assignment." });
      return NextResponse.json({ intent: 'reply', response: `I have deleted the assignment "${match.title}".`, action: { entity: 'assignment', operation: 'delete', count: 1 } });
    }

    if (parsedJSON.intent === 'delete_schedule') {
       const { target_title } = parsedJSON;
       if (!target_title) return NextResponse.json({ intent: 'reply', response: "Which schedule do you want me to delete?" });

       const { data: candidates, error: candidateError } = await getAccessibleScheduleCandidates();
       if (candidateError) {
         return NextResponse.json({ intent: 'reply', response: "I hit a database error while searching schedules." });
       }

       const scoredMatches = getScoredAssignmentMatches(target_title, candidates as Array<{ id: string; title: string }>);
       if (scoredMatches.length === 0) {
         const preview = (candidates || []).slice(0, 3).map((row: { title: string }) => `"${row.title}"`).join(', ');
         const suffix = preview ? ` I found these instead: ${preview}.` : '';
         return NextResponse.json({ intent: 'reply', response: `I could not find a schedule matching "${target_title}".${suffix}` });
       }

       if (scoredMatches.length > 1) {
         const top = scoredMatches[0];
         const runnerUp = scoredMatches[1];
         const scoreGap = top.score - runnerUp.score;
         if (scoreGap < 12) {
           return NextResponse.json({ intent: 'reply', response: getAmbiguityMessage(scoredMatches) });
         }
       }

       const match = scoredMatches[0].candidate;
       const { error } = await supabase.from('schedules').delete().eq('id', match.id);
       if (error) return NextResponse.json({ intent: 'reply', response: "There was an error while deleting the schedule." });
      return NextResponse.json({ intent: 'reply', response: `I have deleted the schedule "${match.title}".`, action: { entity: 'schedule', operation: 'delete', count: 1 } });
    }

    if (parsedJSON.intent === 'edit_schedule') {
      const { target_title, new_title, new_priority, new_trigger_time } = parsedJSON;
      if (!target_title) {
        return NextResponse.json({ intent: 'reply', response: 'Which schedule do you want me to edit?' });
      }

      const { data: candidates, error: candidateError } = await getAccessibleScheduleCandidates();
      if (candidateError) {
        return NextResponse.json({ intent: 'reply', response: 'I hit a database error while searching schedules.' });
      }

      const scoredMatches = getScoredAssignmentMatches(target_title, candidates as Array<{ id: string; title: string }>);
      if (scoredMatches.length === 0) {
        const preview = (candidates || []).slice(0, 3).map((row: { title: string }) => `"${row.title}"`).join(', ');
        const suffix = preview ? ` I found these instead: ${preview}.` : '';
        return NextResponse.json({ intent: 'reply', response: `I could not find a schedule matching "${target_title}".${suffix}` });
      }

      if (scoredMatches.length > 1) {
        const top = scoredMatches[0];
        const runnerUp = scoredMatches[1];
        const scoreGap = top.score - runnerUp.score;
        if (scoreGap < 12) {
          return NextResponse.json({ intent: 'reply', response: getAmbiguityMessage(scoredMatches) });
        }
      }

      const match = scoredMatches[0].candidate;
      const scheduleDetails = (candidates || []).find((row: any) => row.id === match.id) as { trigger_time?: string } | undefined;

      const updates: any = {};
      if (new_title) updates.title = String(new_title).trim();

      const normalizedPriority = normalizeSchedulePriority(new_priority);
      if (new_priority && !normalizedPriority) {
        return NextResponse.json({ intent: 'reply', response: 'I can set schedule priority to Low, Medium, or High.' });
      }
      if (normalizedPriority) updates.priority = normalizedPriority;

      const normalizedTriggerTime = normalizeTriggerTime(new_trigger_time);
      if (new_trigger_time && !normalizedTriggerTime) {
        return NextResponse.json({ intent: 'reply', response: 'Please provide a valid time like 14:30 or 2:30 PM.' });
      }
      if (normalizedTriggerTime) updates.trigger_time = normalizedTriggerTime;

      if (!updates.trigger_time) {
        const inferredRelativeTime = inferRelativeScheduleTimeFromMessage(message, scheduleDetails?.trigger_time);
        if (inferredRelativeTime) {
          updates.trigger_time = inferredRelativeTime;
        }
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ intent: 'reply', response: 'Tell me what to change on the schedule: title, priority, or time.' });
      }

      const { error } = await supabase.from('schedules').update(updates).eq('id', match.id);
      if (error) {
        return NextResponse.json({ intent: 'reply', response: 'There was an error while updating the schedule.' });
      }

      const changedFields = [
        updates.title ? 'title' : null,
        updates.priority ? 'priority' : null,
        updates.trigger_time ? `time (${String(updates.trigger_time).slice(0, 5)})` : null,
      ].filter(Boolean).join(', ');

      return NextResponse.json({
        intent: 'reply',
        response: `I have updated the schedule "${match.title}" (${changedFields}).`,
        action: { entity: 'schedule', operation: 'update', count: 1 },
      });
    }

    if (parsedJSON.intent === 'pause_schedule' || parsedJSON.intent === 'resume_schedule') {
      const { target_title } = parsedJSON;
      const desiredPausedState = parsedJSON.intent === 'pause_schedule';

      if (!target_title) {
        return NextResponse.json({ intent: 'reply', response: `Which schedule do you want me to ${desiredPausedState ? 'pause' : 'resume'}?` });
      }

      const { data: candidates, error: candidateError } = await getAccessibleScheduleCandidates();
      if (candidateError) {
        return NextResponse.json({ intent: 'reply', response: 'I hit a database error while searching schedules.' });
      }

      const scoredMatches = getScoredAssignmentMatches(target_title, candidates as Array<{ id: string; title: string }>);
      if (scoredMatches.length === 0) {
        const preview = (candidates || []).slice(0, 3).map((row: { title: string }) => `"${row.title}"`).join(', ');
        const suffix = preview ? ` I found these instead: ${preview}.` : '';
        return NextResponse.json({ intent: 'reply', response: `I could not find a schedule matching "${target_title}".${suffix}` });
      }

      if (scoredMatches.length > 1) {
        const top = scoredMatches[0];
        const runnerUp = scoredMatches[1];
        const scoreGap = top.score - runnerUp.score;
        if (scoreGap < 12) {
          return NextResponse.json({ intent: 'reply', response: getAmbiguityMessage(scoredMatches) });
        }
      }

      const match = scoredMatches[0].candidate;
      const scheduleDetails = (candidates || []).find((row: any) => row.id === match.id) as { is_paused?: boolean } | undefined;

      if (scheduleDetails?.is_paused === desiredPausedState) {
        return NextResponse.json({
          intent: 'reply',
          response: `The schedule "${match.title}" is already ${desiredPausedState ? 'paused' : 'active'}.`,
        });
      }

      const { error } = await supabase.from('schedules').update({ is_paused: desiredPausedState }).eq('id', match.id);
      if (error) {
        return NextResponse.json({ intent: 'reply', response: `There was an error while trying to ${desiredPausedState ? 'pause' : 'resume'} the schedule.` });
      }

      return NextResponse.json({
        intent: 'reply',
        response: `I have ${desiredPausedState ? 'paused' : 'resumed'} the schedule "${match.title}".`,
        action: { entity: 'schedule', operation: 'update', count: 1 },
      });
    }

     if (parsedJSON.intent === 'edit_assignment') {
       const { target_title, new_title, new_priority, new_status } = parsedJSON;
       if (!target_title) return NextResponse.json({ intent: 'reply', response: "Which assignment do you want me to edit?" });

       const { data: candidates, error: candidateError } = await getAccessibleAssignmentCandidates();
       if (candidateError) {
         return NextResponse.json({ intent: 'reply', response: "I hit a database error while searching assignments." });
       }

       const scoredMatches = getScoredAssignmentMatches(target_title, candidates as Array<{ id: string; title: string }>);
       if (scoredMatches.length === 0) {
         const preview = (candidates || []).slice(0, 3).map((row: { title: string }) => `"${row.title}"`).join(', ');
         const suffix = preview ? ` I found these instead: ${preview}.` : '';
         return NextResponse.json({ intent: 'reply', response: `I could not find an assignment matching "${target_title}".${suffix}` });
       }

       if (scoredMatches.length > 1) {
         const top = scoredMatches[0];
         const runnerUp = scoredMatches[1];
         const scoreGap = top.score - runnerUp.score;
         if (scoreGap < 12) {
           return NextResponse.json({ intent: 'reply', response: getAmbiguityMessage(scoredMatches) });
         }
       }

       const match = scoredMatches[0].candidate;

       const updates: any = {};
       if (new_title) updates.title = new_title;
       if (new_priority) updates.priority = new_priority;

       const normalizedStatus = normalizeAssignmentStatus(new_status);
       if (new_status && !normalizedStatus) {
         return NextResponse.json({ intent: 'reply', response: 'I can set status to Pending, In Progress, Completed, or Overdue. Which one should I use?' });
       }
       if (normalizedStatus) updates.status = normalizedStatus;

       if (Object.keys(updates).length === 0) {
         return NextResponse.json({ intent: 'reply', response: 'Tell me what to change: title, priority, or status.' });
       }

       const { error } = await supabase.from('assignments').update(updates).eq('id', match.id);
       if (error) return NextResponse.json({ intent: 'reply', response: "There was an error updating the assignment." });

       const changedFields = [
         updates.title ? 'title' : null,
         updates.priority ? 'priority' : null,
         updates.status ? `status (${updates.status})` : null,
       ].filter(Boolean).join(', ');

      return NextResponse.json({ intent: 'reply', response: `I have updated the assignment "${match.title}" (${changedFields}).`, action: { entity: 'assignment', operation: 'update', count: 1 } });
    }

    // Default: pass it back to frontend to handle (create_task, create_schedule)
    return NextResponse.json(parsedJSON);

  } catch (error: any) {
    console.error('Error in AI Chat API route:', error);
    const isQuota = error.message?.includes('429') || error.message?.includes('quota');
    return NextResponse.json(
      { error: isQuota
          ? 'API rate limit exceeded. Your Gemini free tier quota is exhausted.'
          : `AI request failed: ${error.message || 'Unknown error'}`
      },
      { status: isQuota ? 429 : 500 }
    );
  }
}
