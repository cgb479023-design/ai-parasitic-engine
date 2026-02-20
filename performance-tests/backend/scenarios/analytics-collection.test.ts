import http from 'k6/http';
import { check, sleep } from 'k6';

// Define shared data
const API_KEY = __ENV.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY'; // Replace with actual API key or env var
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL_NAME = 'gemini-2.0-flash-exp'; // Model used in geminiService.ts

export const options = {
  vus: 5, // 5 virtual users
  duration: '30s', // for 30 seconds
  thresholds: {
    http_req_duration: ['p(95)<10000'], // 95% of requests must complete within 10 seconds
    'checks': ['rate>0.99'], // 99% of checks must pass
  },
};

export default function () {
  const url = `${BASE_URL}/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

  // Simulate analyticsData and systemInstruction from geminiService.ts
  const sampleAnalyticsData = {
    "channelOverview": {
      "category": "channelOverview",
      "results": [
        { "question": "Total views last 28 days", "response": "1,234,567 views", "timestamp": Date.now() },
        { "question": "Subscribers gained last 28 days", "response": "12,345", "timestamp": Date.now() }
      ],
      "successCount": 2, "totalCount": 2
    },
    "videoPerformance": {
      "category": "videoPerformance",
      "results": [
        { "question": "Top video last 7 days", "response": "Viral Cat Video: 500,000 views", "timestamp": Date.now() }
      ],
      "successCount": 1, "totalCount": 1
    }
  };

  const sampleSystemInstruction = `
    You are an expert at analyzing YouTube channel performance and generating strategic plans.
    Based on the provided analytics data, give detailed insights and actionable recommendations.
  `;

  const sampleContents = `Generate a detailed video prompt and virality analysis for: ${JSON.stringify({
    prompt: "A short video about quantum computing",
    category: "Education"
  })}`;

  const requestBody = {
    contents: [{ parts: [{ text: sampleContents }] }],
    config: {
      systemInstruction: { parts: [{ text: sampleSystemInstruction }] },
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      responseSchema: {
        type: "object",
        properties: {
          fullPrompt: { type: "string" },
          viralityAnalysis: {
            type: "object",
            properties: {
              score: {
                type: "object",
                properties: { score: { type: "number" }, grade: { type: "string" } }
              }
            }
          }
        }
      }
    }
  };

  const res = http.post(url, JSON.stringify(requestBody), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status was 200': (r) => r.status === 200,
    'response is JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (e) {
        console.error('Failed to parse JSON response:', r.body);
        return false;
      }
    },
    'response contains viralityAnalysis': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json && json.viralityAnalysis !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  sleep(1);
}