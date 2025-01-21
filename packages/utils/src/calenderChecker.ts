// packages/email-utils/src/calendarChecker.ts
import { google } from 'googleapis';
import { addMinutes, parseISO, format } from 'date-fns';

export class CalendarChecker {
  private calendar;

  constructor() {
    this.calendar = google.calendar({ version: 'v3' });
  }

  async checkAvailability(
    startTime: string,
    endTime: string,
    duration: number = 30
  ): Promise<string[]> {
    // This is a simplified version - we'll expand this
    const availableSlots: string[] = [];
    const start = parseISO(startTime);
    const end = parseISO(endTime);

    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          items: [{ id: 'primary' }]
        }
      });

      // Process busy periods and find available slots
      const busyPeriods = response.data.calendars?.primary?.busy || [];
      let currentTime = start;

      while (currentTime < end) {
        const slotEnd = addMinutes(currentTime, duration);
        const isSlotAvailable = !busyPeriods.some(period => 
          currentTime >= parseISO(period.start) && 
          slotEnd <= parseISO(period.end)
        );

        if (isSlotAvailable) {
          availableSlots.push(format(currentTime, "yyyy-MM-dd'T'HH:mm:ssXXX"));
        }

        currentTime = addMinutes(currentTime, 30); // Check next slot
      }

      return availableSlots;
    } catch (error) {
      console.error('Error checking calendar availability:', error);
      return [];
    }
  }
}