// packages/ai-core/src/emailProcessor.ts
import { EmailParser } from './emailParser';
import { CalendarChecker } from '../../utils/src/calenderChecker';
import { EmailContent, MeetingRequest, SchedulingResult } from './type';

export class EmailProcessor {
  private emailParser: EmailParser;
  private calendarChecker: CalendarChecker;

  constructor(openaiApiKey: string) {
    this.emailParser = new EmailParser(openaiApiKey);
    this.calendarChecker = new CalendarChecker();
  }

  async processEmail(email: EmailContent): Promise<SchedulingResult | null> {
    // 1. Parse the email for meeting request
    const meetingRequest = await this.emailParser.parseMeetingRequest(email);
    
    if (!meetingRequest) {
      return null;
    }

    // 2. If specific times were suggested, check those times
    let availableSlots: string[] = [];
    
    if (meetingRequest.suggestedTimes && meetingRequest.suggestedTimes.length > 0) {
      for (const time of meetingRequest.suggestedTimes) {
        const endTime = addMinutes(parseISO(time), meetingRequest.duration || 30);
        const slots = await this.calendarChecker.checkAvailability(
          time,
          endTime.toISOString(),
          meetingRequest.duration
        );
        availableSlots.push(...slots);
      }
    } else {
      // 3. If no times suggested, check next 5 business days
      const startTime = new Date();
      const endTime = addBusinessDays(startTime, 5);
      availableSlots = await this.calendarChecker.checkAvailability(
        startTime.toISOString(),
        endTime.toISOString(),
        meetingRequest.duration
      );
    }

    return {
      availableSlots,
      recommendedSlot: availableSlots[0], // Take first available slot as recommendation
      duration: meetingRequest.duration || 30
    };
  }
}