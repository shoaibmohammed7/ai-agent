
import express from 'express';
import { OpenAI } from 'openai';
import { google } from 'googleapis';
import { addMinutes, parseISO, format } from 'date-fns';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Google Calendar
const calendar = google.calendar({ version: 'v3' });

// Types
interface EmailRequest {
  from: string;
  subject: string;
  content: string;
  timestamp: string;
  threadId: string;
}

interface SchedulingResult {
  availableSlots: string[];
  recommendedSlot: string;
  duration: number;
}

interface CalendarEvent {
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  attendees: string[];
}

// Email Analysis Functions
async function analyzeEmailForMeeting(email: EmailRequest) {
  const prompt = `
    Analyze this email and determine if it's a meeting request. 
    Extract relevant information including suggested times, duration, and purpose.

    Email Content:
    Subject: ${email.subject}
    ${email.content}

    Return JSON:
    {
      "isMeetingRequest": boolean,
      "suggestedTimes": string[] or null,
      "duration": number (in minutes) or null,
      "purpose": string or null
    }
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  return JSON.parse(response.choices[0].message.content);
}

// Calendar Functions
async function checkCalendarAvailability(
  startTime: string,
  endTime: string,
  duration: number = 30
): Promise<string[]> {
  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: startTime,
        timeMax: endTime,
        items: [{ id: 'primary' }]
      }
    });

    const busyPeriods = response.data.calendars?.primary?.busy || [];
    const availableSlots: string[] = [];
    let currentTime = new Date(startTime);
    const endDateTime = new Date(endTime);

    while (currentTime < endDateTime) {
      const slotEnd = addMinutes(currentTime, duration);
      const isSlotAvailable = !busyPeriods.some(period => 
        currentTime >= new Date(period.start) && 
        slotEnd <= new Date(period.end)
      );

      if (isSlotAvailable) {
        availableSlots.push(currentTime.toISOString());
      }

      currentTime = addMinutes(currentTime, 30);
    }

    return availableSlots;
  } catch (error) {
    console.error('Error checking calendar availability:', error);
    throw error;
  }
}

async function createCalendarEvent(event: CalendarEvent) {
  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.summary,
        description: event.description,
        start: {
          dateTime: event.startTime,
          timeZone: 'UTC'
        },
        end: {
          dateTime: event.endTime,
          timeZone: 'UTC'
        },
        attendees: event.attendees.map(email => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `meeting-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      },
      conferenceDataVersion: 1,
      sendUpdates: 'all'
    });

    return response.data;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
}

// API Endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.post('/process-email', async (req, res) => {
  try {
    const email: EmailRequest = req.body;

    // Analyze email for meeting request
    const analysis = await analyzeEmailForMeeting(email);

    if (!analysis.isMeetingRequest) {
      return res.json({
        status: 'not_meeting_request',
        message: 'This email does not appear to be a meeting request.'
      });
    }

    // Check calendar availability
    const startTime = new Date();
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + 7); // Look ahead 7 days

    let availableSlots: string[] = [];

    if (analysis.suggestedTimes && analysis.suggestedTimes.length > 0) {
      // Check specific suggested times
      for (const time of analysis.suggestedTimes) {
        const timeSlots = await checkCalendarAvailability(
          time,
          addMinutes(new Date(time), analysis.duration || 30).toISOString(),
          analysis.duration
        );
        availableSlots.push(...timeSlots);
      }
    } else {
      // Check next 7 days
      availableSlots = await checkCalendarAvailability(
        startTime.toISOString(),
        endTime.toISOString(),
        analysis.duration || 30
      );
    }

    // Generate response
    const scheduleResult: SchedulingResult = {
      availableSlots,
      recommendedSlot: availableSlots[0],
      duration: analysis.duration || 30
    };

    res.json({
      status: 'success',
      analysis,
      scheduling: scheduleResult
    });

  } catch (error) {
    console.error('Error processing email:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.post('/schedule-meeting', async (req, res) => {
  try {
    const event: CalendarEvent = req.body;
    const scheduledEvent = await createCalendarEvent(event);

    res.json({
      status: 'success',
      event: scheduledEvent
    });
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;