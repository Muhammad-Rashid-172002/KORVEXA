// Signed-in critical paths: login, dashboard data, project room, chat history. Uses the demo buyer from `pnpm db:seed:demo`.
//   docker run --rm -i -e API=http://host.docker.internal:4000 grafana/k6 run - < infra/load/authed.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';

const API = __ENV.API || 'http://localhost:4000';
const ORIGIN = __ENV.ORIGIN || 'http://localhost:3000';

export const options = {
  scenarios: {
    users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 20 },
        { duration: '40s', target: 40 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<600'] },
};

export default function () {
  const jar = http.cookieJar();
  group('login', () => {
    const r = http.post(
      `${API}/v1/auth/sign-in/email`,
      JSON.stringify({ email: 'buyer@dev.glasswork.test', password: 'Glasswork-dev-123!' }),
      {
        headers: { 'content-type': 'application/json', origin: ORIGIN },
      },
    );
    check(r, { 'login ok': (x) => x.status === 200 || x.status === 429 });
  });
  const h = { headers: { origin: ORIGIN } };
  const me = http.get(`${API}/v1/me`, h);
  if (me.status !== 200) return sleep(2);
  const projects = http.get(`${API}/v1/projects?limit=20`, h);
  check(projects, { 'projects 200': (x) => x.status === 200 });
  const first = (projects.json('items') || [])[0];
  if (first) {
    check(http.get(`${API}/v1/projects/${first.id}`, h), { 'room 200': (x) => x.status === 200 });
    check(http.get(`${API}/v1/projects/${first.id}/events?limit=20`, h), {
      'activity ok': (x) => x.status === 200,
    });
  }
  check(http.get(`${API}/v1/me/notifications?limit=20`, h), { 'notifications 200': (x) => x.status === 200 });
  sleep(1);
}
