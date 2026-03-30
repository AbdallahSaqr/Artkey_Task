import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured in the environment.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Log first 4 chars of key for debugging purposes (safe)
    console.log(`API check: Using key starting with ${apiKey.substring(0, 4)}...`);
    
    const { message, history } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'A valid message string is required.' },
        { status: 400 }
      );
    }

    // Build conversation context from history
    const today = new Date().toISOString().split('T')[0];
    const systemInstruction = `System: The user is interacting with an Assignment Management Dashboard. Today's date is ${today}. Your job is to extract task details from the ENTIRE conversation so far, accumulating information across messages. Return strictly valid JSON with no markdown formatting or code blocks. Use this exact schema: { "intent": "create_task" | "insufficient_info", "title": "string", "description": "string", "recurrence_type": "None" | "Daily" | "Weekly" | "Monthly", "trigger_time": "HH:MM" (in 24h format), "due_date": "YYYY-MM-DD", "priority": "Low" | "Medium" | "High" }. If the user says "tomorrow", calculate the actual date from today (${today}). Only set intent to 'insufficient_info' if the title is truly missing. If a time isn't specified, default to "09:00". If priority isn't specified, default to "Medium". If recurrence isn't specified, default to "None". When intent is 'insufficient_info', include a 'response' field asking ONLY for what is actually missing. Be lenient — infer as much as possible from context.`;

    // Build the full prompt with conversation history for context
    let conversationContext = '';
    if (Array.isArray(history) && history.length > 0) {
      conversationContext = history
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');
      conversationContext += '\n';
    }
    const prompt = `${systemInstruction}\n\nConversation so far:\n${conversationContext}User: ${message}`;

    // Models to try in order
    const models = ['gemini-3.1-flash-lite-preview'];
    let result;
    let lastError: any;

    for (const modelName of models) {
      try {
        const currentModel = genAI.getGenerativeModel({ model: modelName });
        result = await currentModel.generateContent(prompt);
        break;
      } catch (e: any) {
        lastError = e;
        const isRetryable = e.message?.includes('404') || e.message?.includes('429');
        if (isRetryable) {
          console.log(`${modelName} failed (${e.message?.includes('429') ? '429 rate limit' : '404'}). Trying next model...`);
          continue;
        }
        throw e;
      }
    }

    if (!result) {
      if (lastError?.message?.includes('429')) {
        return NextResponse.json(
          { error: 'API rate limit exceeded. Your Gemini free tier quota is exhausted. Please wait a minute or upgrade your plan at https://ai.google.dev.' },
          { status: 429 }
        );
      }
      throw lastError || new Error('Generative AI failed to return a result.');
    }

    const responseText = result.response.text();

    // Safety parse: Strip out any phantom markdown wrapper ticks 
    // just in case the model defies the 'no markdown formatting' stricture occasionally.
    const cleanJSONString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedJSON = JSON.parse(cleanJSONString);

    // Return the successfully serialized result pattern
    return NextResponse.json(parsedJSON);
  } catch (error: any) {
    console.error('Error in AI Chat API route:', error);
    const isQuota = error.message?.includes('429') || error.message?.includes('quota');
    return NextResponse.json(
      { error: isQuota
          ? 'API rate limit exceeded. Your Gemini free tier quota is exhausted. Please wait a minute or upgrade your plan at https://ai.google.dev.'
          : `AI request failed: ${error.message || 'Unknown error'}`
      },
      { status: isQuota ? 429 : 500 }
    );
  }
}
