// Public read paths: marketing pages, search, service detail, seller profile. Anonymous traffic.
//   docker run --rm -i -e WEB=http://host.docker.internal:3000 -e API=http://host.docker.internal:4000 grafana/k6 run - < infra/load/public.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const WEB = __ENV.WEB || 'http://localhost:3000';
const API = __ENV.API || 'http://localhost:4000';

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 25 },
        { duration: '40s', target: 50 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:page}': ['p(95)<800'],
    'http_req_duration{kind:api}': ['p(95)<400'],
  },
};

export default function () {
  const pages = [
    '/',
    '/services',
    '/how-it-works',
    '/pricing',
    '/help',
    '/services/demo-nextjs-saas-mvp',
    '/u/amara-okafor',
  ];
  const p = pages[Math.floor(Math.random() * pages.length)];
  check(http.get(`${WEB}${p}`, { tags: { kind: 'page' } }), { 'page 200': (r) => r.status === 200 });
  check(http.get(`${API}/v1/services?limit=12&q=app`, { tags: { kind: 'api' } }), {
    'search 200': (r) => r.status === 200,
  });
  check(http.get(`${API}/v1/services?category=web-development&sort=rating`, { tags: { kind: 'api' } }), {
    'list 200': (r) => r.status === 200,
  });
  sleep(1);
}
