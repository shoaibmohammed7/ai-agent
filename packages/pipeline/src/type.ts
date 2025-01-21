// packages/ai-core/src/types.ts
export interface EmailContent {
    from: string;
    subject: string;
    content: string;
    timestamp: string;
    threadId: string;
  }
  
  export interface MeetingRequest {
    requestedBy: string;
    suggestedTimes?: string[];
    duration?: number;
    subject?: string;
  }
  
  export interface SchedulingResult {
    availableSlots: string[];
    recommendedSlot: string;
    duration: number;
  }