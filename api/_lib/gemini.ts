/** Minimal Google Gemini client (REST generateContent with structured JSON output). */

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiResult<T> {
  data: T;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export async function generateJson<T>({
  system,
  parts,
  schema,
  temperature = 0.4,
  maxOutputTokens = 4096,
  timeoutMs = 45000,
}: {
  system: string;
  parts: GeminiPart[];
  schema: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<GeminiResult<T>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("Writing assistance is not configured.", 503);
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        ],
      }),
    });
  } catch (error) {
    throw new GeminiError(
      (error as Error).name === "AbortError" ? "Assistance took too long. Try again." : "Assistance is unreachable.",
      504,
    );
  } finally {
    clearTimeout(timer);
  }

  const body = (await response.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    error?: { message?: string; status?: string };
  };

  if (!response.ok) {
    console.error("Gemini error", response.status, body.error?.status, body.error?.message);
    throw new GeminiError(
      response.status === 429 ? "Assistance is busy right now. Try again shortly." : "Assistance is unavailable right now.",
      response.status === 429 ? 429 : 502,
    );
  }

  const candidate = body.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text) {
    throw new GeminiError(
      candidate?.finishReason === "SAFETY" ? "This request couldn’t be processed." : "Assistance returned nothing.",
      502,
    );
  }

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new GeminiError("Assistance returned an unreadable answer.", 502);
  }

  return {
    data,
    model,
    tokensIn: body.usageMetadata?.promptTokenCount || 0,
    tokensOut: body.usageMetadata?.candidatesTokenCount || 0,
  };
}
