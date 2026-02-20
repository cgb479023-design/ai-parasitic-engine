import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1, // 1 virtual user
  duration: '10s', // for 10 seconds
  ext: {
    loadimpact: {
      projectID: 3584852,
      // Test run segmenting
      distribution: {
        'amazon:fr:paris': { loadZone: 'amazon:fr:paris', percent: 100 },
      },
    },
  },
};

export default function () {
  const res = http.get('YOUR_API_BASE_URL/health'); // Replace with a stable API endpoint like /health or a basic data endpoint from Golden Function #31
  check(res, { 'status was 200': (r) => r.status == 200 });
  sleep(1);
}