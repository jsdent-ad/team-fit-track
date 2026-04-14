import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정되지 않았습니다. ' +
      '.env.local 또는 Vercel 프로젝트 Environment Variables 를 확인해주세요.'
  );
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'public-anon-key', {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } },
});

export type SupabaseSchema = {
  teams: {
    id: string;
    name: string;
    code: string;
    created_at: string;
  };
  members: {
    id: string;
    team_id: string;
    name: string;
    password_hash: string;
    goal_type: 'weight' | 'bodyFat' | 'skeletalMuscle';
    goal_start: number;
    goal_target: number;
    goal_current: number;
    goal_unit: string;
    tour_completed: boolean;
    celebrated: boolean;
    created_at: string;
  };
  certifications: {
    id: string;
    team_id: string;
    member_id: string;
    image_data_url: string;
    caption: string | null;
    created_at: string;
  };
  team_challenges: {
    id: string;
    team_id: string;
    title: string;
    target_count: number;
    theme_emoji: string;
    start_date: string;
    end_date: string;
    created_at: string;
  };
};

// Simple team code generator: 6-char alphanumeric, uppercase, unambiguous.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateTeamCode(length = 6): string {
  let out = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export async function hashPassword(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
