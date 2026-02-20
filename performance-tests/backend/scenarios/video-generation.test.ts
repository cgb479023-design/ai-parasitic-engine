import http from 'k6/http';
import { check, sleep } from 'k6';
import { VeoGenerateParams, VEO_MODELS } from '../../../../services/veoService'; // Adjust path as needed

// Define shared data (e.g., API key, base URL)
const API_KEY = __ENV.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY'; // Replace with actual API key or env var
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export const options = {
  vus: 10, // 10 virtual users
  duration: '60s', // for 60 seconds
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests must complete within 5 seconds
    'checks': ['rate>0.99'], // 99% of checks must pass
  },
};

export default function () {
  // Step 1: Initiate video generation
  const initiateUrl = `${BASE_URL}/models/${VEO_MODELS.VEO_3_1_FAST}:predictLongRunning?key=${API_KEY}`;
  const generateParams: VeoGenerateParams = {
    prompt: 'A futuristic city at sunset with flying cars',
    model: VEO_MODELS.VEO_3_1_FAST,
    aspectRatio: '16:9',
    resolution: '720p',
    durationSeconds: 8,
  };

  const initiateRes = http.post(initiateUrl, JSON.stringify({
    instances: [{ prompt: generateParams.prompt }],
    parameters: {
      aspectRatio: generateParams.aspectRatio,
      resolution: generateParams.resolution,
      durationSeconds: generateParams.durationSeconds,
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(initiateRes, {
    'initiate status was 200': (r) => r.status === 200,
    'initiate has operation name': (r) => r.json() && r.json().name !== undefined,
  });

  const operationName = initiateRes.json('name');
  if (!operationName) {
    console.error('Failed to get operation name from initiate response:', initiateRes.body);
    return;
  }

  // Step 2: Poll for completion
  let done = false;
  const pollInterval = 10000; // 10 seconds
  const maxPollDuration = 600000; // 10 minutes timeout
  const startTime = new Date().getTime();

  while (!done && (new Date().getTime() - startTime < maxPollDuration)) {
    const pollUrl = `${BASE_URL}/${operationName}?key=${API_KEY}`;
    const pollRes = http.get(pollUrl);

    check(pollRes, {
      'poll status was 200': (r) => r.status === 200,
      'poll response has done status': (r) => r.json() && r.json().done !== undefined,
    });

    const pollData = pollRes.json();
    if (pollData) {
      done = pollData.done;
      if (pollData.error) {
        console.error('Video generation error during polling:', pollData.error.message);
        break; // Exit loop on error
      }
    } else {
      console.error('Poll response body is empty or invalid JSON:', pollRes.body);
    }

    if (!done) {
      sleep(pollInterval / 1000); // k6 sleep expects seconds
    }
  }

  check(done, { 'video generation completed': (d) => d === true });
  if (!done) {
    console.error('Video generation timed out.');
  }

  sleep(1); // Wait for 1 second before the next iteration
}