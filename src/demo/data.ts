import type { Tribute } from '../lib/data';
import serverRoom from './assets/server_room.jpg';
import whiteboard from './assets/whiteboard.jpg';
import teamDinner from './assets/team_dinner.jpg';
import teamOffice from './assets/team_office.jpg';

// ---------------------------------------------------------------------------
// Fictional samples, loaded only in explicit demo mode
// ---------------------------------------------------------------------------
export function demoTributes(): Tribute[] {
  const photos: Record<string, string> = { server_room: serverRoom, whiteboard, team_dinner: teamDinner, team_office: teamOffice };
  const P = (name: string) => photos[name]!;
  const samples: Array<[string, string, string, string[]]> = [
    ['Aiko Tanaka', 'Infrastructure', 'Thank you for always believing in us, even on the longest incident nights. You taught me that calm is a superpower. I will miss our Friday syncs!', [P('server_room')]],
    ['Kenji Sato', 'Service Desk', 'Your door was always open. Thank you for the mentorship, the laughs and the ramen recommendations. Best of luck on your next adventure!', []],
    ['Yuki Watanabe', 'Security', 'You made security everyone’s job — in the best way. Thank you for championing our team.', []],
    ['Daniel Kim', 'Cloud Platform', 'From the data center migration to the cloud, you led from the front. It was an honour to build with you.', [P('whiteboard')]],
    ['Haruka Ito', 'Applications', 'Thank you for pushing me to present at the all-hands. I would never have done it without your encouragement. 本当にありがとうございました！', []],
    ['Takeshi Nakamura', 'Network', 'Five-nines uptime and five-star leadership. We will keep the lights on — promise.', [P('team_dinner'), P('team_office')]],
    ['Mei Suzuki', 'PMO', 'You turned impossible deadlines into achievable plans. Thank you for your patience and kindness.', []],
    ['Ryo Yamamoto', 'End-User Computing', 'Thank you for every “good job” message on Teams. They meant more than you know.', []],
    ['Sakura Kobayashi', 'Data & Analytics', 'You always asked “what does the data say?” — and then listened. Wishing you all the best, Joel!', [P('team_office')]],
  ];
  const base = Date.now() - samples.length * 86_400_000;
  return samples.map(([name, team, message, photos], i) => ({
    id: `demo-${i}`,
    created_at: new Date(base + i * 86_400_000).toISOString(),
    name,
    team,
    message,
    photo_paths: photos,
    video_path: null,
    video_link: null,
  }));
}
