import { OpenAI } from 'openai';
import { EmailContent, MeetingRequest } from './type';

export class EmailParser {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async parseMeetingRequest(email: EmailContent): Promise<MeetingRequest | null> {
    const prompt = `
      Analyze this email and determine if it's a meeting request. If it is, extract key information:
      
      Email Content:
      ${email.content}

      Return in JSON format:
      {
        "isMeetingRequest": boolean,
        "requestedBy": "email address",
        "suggestedTimes": ["time1", "time2"],
        "duration": number (in minutes),
        "subject": "meeting subject"
      }
    `;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0]?.message?.content? || [] );
    
    if (!result.isMeetingRequest) {
      return null;
    }

    return {
      requestedBy: result.requestedBy,
      suggestedTimes: result.suggestedTimes,
      duration: result.duration || 30, // default to 30 minutes if not specified
      subject: result.subject
    };
  }
}