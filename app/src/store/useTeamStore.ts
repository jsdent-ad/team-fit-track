import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase, hashPassword, validateTeamCode, type SupabaseSchema } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { goalScore } from './score';

export type GoalType = 'weight' | 'bodyFat' | 'skeletalMuscle';

export const GOAL_TYPE_LABEL: Record<GoalType, string> = {
  weight: '체중',
  bodyFat: '체지방량',
  skeletalMuscle: '골격근량',
};

export const GOAL_TYPE_DEFAULT_UNIT: Record<GoalType, string> = {
  weight: 'kg',
  bodyFat: 'kg',
  skeletalMuscle: 'kg',
};

export type Team = SupabaseSchema['teams'];

export type Member = {
  id: string;
  teamId: string;
  name: string;
  passwordHash: string;
  goalType: GoalType;
  goalStart: number;
  goalTarget: number;
  goalCurrent: number;
  goalUnit: string;
  tourCompleted: boolean;
  celebrated: boolean;
  isLeader: boolean;
  createdAt: string;
};

export type Certification = {
  id: string;
  teamId: string;
  memberId: string;
  imageDataUrl: string;
  caption?: string | null;
  createdAt: string;
};

export type TeamChallenge = {
  id: string;
  teamId: string;
  title: string;
  targetCount: number;
  themeEmoji: string;
  startDate: string;
  endDate: string;
};

export type AuthResult =
  | { ok: true }
  | { ok: false; reason: 'name-empty' | 'password-empty' | 'name-exists' | 'not-found' | 'wrong-password' | 'team-not-found' | 'team-name-empty' | 'network' };

export type CreateTeamResult =
  | { ok: true; teamId: string; code: string }
  | { ok: false; reason: 'team-name-empty' | 'code-invalid' | 'code-taken' | 'network'; message?: string };

function rowToMember(r: SupabaseSchema['members']): Member {
  return {
    id: r.id,
    teamId: r.team_id,
    name: r.name,
    passwordHash: r.password_hash,
    goalType: r.goal_type,
    goalStart: Number(r.goal_start),
    goalTarget: Number(r.goal_target),
    goalCurrent: Number(r.goal_current),
    goalUnit: r.goal_unit,
    tourCompleted: r.tour_completed,
    celebrated: r.celebrated,
    isLeader: Boolean(r.is_leader),
    createdAt: r.created_at,
  };
}

function rowToCert(r: SupabaseSchema['certifications']): Certification {
  return {
    id: r.id,
    teamId: r.team_id,
    memberId: r.member_id,
    imageDataUrl: r.image_data_url,
    caption: r.caption,
    createdAt: r.created_at,
  };
}

function rowToChallenge(r: SupabaseSchema['team_challenges']): TeamChallenge {
  return {
    id: r.id,
    teamId: r.team_id,
    title: r.title,
    targetCount: r.target_count,
    themeEmoji: r.theme_emoji,
    startDate: r.start_date,
    endDate: r.end_date,
  };
}

function normalizeName(n: string): string {
  return n.trim().toLowerCase();
}

// -----------------------------------------------------------------------------
// Session slice (persisted in localStorage)
// -----------------------------------------------------------------------------

interface SessionSlice {
  currentTeamId: string | null;
  currentTeamCode: string | null;
  currentTeamName: string | null;
  currentMemberId: string | null;
}

// -----------------------------------------------------------------------------
// Cache slice (populated from Supabase; not persisted)
// -----------------------------------------------------------------------------

interface CacheSlice {
  members: Member[];
  certifications: Certification[];
  teamChallenge: TeamChallenge | null;
  loading: boolean;
  error: string | null;
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

let realtimeChannel: RealtimeChannel | null = null;

export interface TeamState extends SessionSlice, CacheSlice {
  // Team flow
  createTeam: (name: string, code: string) => Promise<CreateTeamResult>;
  joinTeam: (code: string) => Promise<AuthResult>;
  leaveTeam: () => void;

  // Auth
  signup: (input: {
    name: string;
    password: string;
    goalType?: GoalType;
    goalStart?: number;
    goalTarget?: number;
    goalCurrent?: number;
    goalUnit?: string;
  }) => Promise<AuthResult>;
  login: (name: string, password: string) => Promise<AuthResult>;
  logout: () => void;

  // Profile (only for current member)
  updateMyProfile: (patch: Partial<{
    name: string;
    goalType: GoalType;
    goalStart: number;
    goalTarget: number;
    goalCurrent: number;
    goalUnit: string;
  }>) => Promise<void>;
  removeMyself: () => Promise<void>;

  // Certifications
  addCertification: (input: { imageDataUrl: string; caption?: string; certDate?: string }) => Promise<void>;
  updateMyCertification: (id: string, patch: { caption?: string | null }) => Promise<void>;
  removeMyCertification: (id: string) => Promise<void>;

  // Challenge
  setTeamChallenge: (c: Omit<TeamChallenge, 'id' | 'teamId'>) => Promise<void>;
  deleteTeamChallenge: () => Promise<void>;

  // Flags
  markTourCompleted: () => Promise<void>;
  markCelebrated: (memberId: string) => Promise<void>;

  // Data hydration
  hydrate: () => Promise<void>;
  getCurrentMember: () => Member | undefined;
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => {
      const setCache = (patch: Partial<CacheSlice>) => set((s) => ({ ...s, ...patch }));

      const subscribeRealtime = (teamId: string) => {
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel);
          realtimeChannel = null;
        }
        realtimeChannel = supabase
          .channel(`team-${teamId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'members', filter: `team_id=eq.${teamId}` },
            (payload) => {
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const m = rowToMember(payload.new as SupabaseSchema['members']);
                set((s) => {
                  // Guard against Realtime races: if we locally believe this
                  // member is celebrated, keep it true even if an older DB row
                  // comes through. Server becomes authoritative only for
                  // true→false transitions, which we never intentionally do.
                  const prev = s.members.find((x) => x.id === m.id);
                  const merged: Member =
                    prev && prev.celebrated && !m.celebrated
                      ? { ...m, celebrated: true }
                      : m;
                  return {
                    members: [...s.members.filter((x) => x.id !== m.id), merged].sort(
                      (a, b) => a.createdAt.localeCompare(b.createdAt)
                    ),
                  };
                });
              } else if (payload.eventType === 'DELETE') {
                const id = (payload.old as { id: string }).id;
                set((s) => ({
                  members: s.members.filter((x) => x.id !== id),
                  currentMemberId: s.currentMemberId === id ? null : s.currentMemberId,
                }));
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'certifications', filter: `team_id=eq.${teamId}` },
            (payload) => {
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const c = rowToCert(payload.new as SupabaseSchema['certifications']);
                set((s) => ({
                  certifications: [...s.certifications.filter((x) => x.id !== c.id), c].sort((a, b) =>
                    b.createdAt.localeCompare(a.createdAt)
                  ),
                }));
              } else if (payload.eventType === 'DELETE') {
                const id = (payload.old as { id: string }).id;
                set((s) => ({
                  certifications: s.certifications.filter((x) => x.id !== id),
                }));
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'team_challenges', filter: `team_id=eq.${teamId}` },
            (payload) => {
              if (payload.eventType === 'DELETE') {
                set({ teamChallenge: null });
              } else {
                set({ teamChallenge: rowToChallenge(payload.new as SupabaseSchema['team_challenges']) });
              }
            }
          )
          .subscribe();
      };

      return {
        // Session
        currentTeamId: null,
        currentTeamCode: null,
        currentTeamName: null,
        currentMemberId: null,

        // Cache
        members: [],
        certifications: [],
        teamChallenge: null,
        loading: false,
        error: null,

        createTeam: async (name, code) => {
          const trimmed = name.trim();
          if (!trimmed) return { ok: false, reason: 'team-name-empty' };
          const validated = validateTeamCode(code);
          if (!validated.ok) {
            return { ok: false, reason: 'code-invalid', message: validated.reason };
          }
          const { data, error } = await supabase
            .from('teams')
            .insert({ name: trimmed, code: validated.normalized })
            .select()
            .single();
          if (error) {
            if (error.code === '23505') {
              return { ok: false, reason: 'code-taken' };
            }
            console.error('[createTeam]', error);
            return { ok: false, reason: 'network' };
          }
          if (!data) return { ok: false, reason: 'network' };
          set({
            currentTeamId: data.id,
            currentTeamCode: data.code,
            currentTeamName: data.name,
            currentMemberId: null,
            members: [],
            certifications: [],
            teamChallenge: null,
          });
          subscribeRealtime(data.id);
          return { ok: true, teamId: data.id, code: data.code };
        },

        joinTeam: async (code) => {
          const trimmed = code.trim().toUpperCase();
          if (!trimmed) return { ok: false, reason: 'team-not-found' };
          const { data, error } = await supabase
            .from('teams')
            .select('*')
            .eq('code', trimmed)
            .maybeSingle();
          if (error) {
            console.error('[joinTeam]', error);
            return { ok: false, reason: 'network' };
          }
          if (!data) return { ok: false, reason: 'team-not-found' };
          set({
            currentTeamId: data.id,
            currentTeamCode: data.code,
            currentTeamName: data.name,
            currentMemberId: null,
          });
          subscribeRealtime(data.id);
          await get().hydrate();
          return { ok: true };
        },

        leaveTeam: () => {
          if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
          }
          set({
            currentTeamId: null,
            currentTeamCode: null,
            currentTeamName: null,
            currentMemberId: null,
            members: [],
            certifications: [],
            teamChallenge: null,
          });
        },

        signup: async ({ name, password, goalType, goalStart, goalTarget, goalCurrent, goalUnit }) => {
          const teamId = get().currentTeamId;
          if (!teamId) return { ok: false, reason: 'team-not-found' };
          const trimmed = name.trim();
          if (!trimmed) return { ok: false, reason: 'name-empty' };
          if (!password) return { ok: false, reason: 'password-empty' };
          const { data: existing } = await supabase
            .from('members')
            .select('id,name')
            .eq('team_id', teamId);
          const existingList = existing ?? [];
          const collide = existingList.some(
            (m) => normalizeName(m.name) === normalizeName(trimmed)
          );
          if (collide) return { ok: false, reason: 'name-exists' };
          const isLeader = existingList.length === 0; // first signup in the team
          const hash = await hashPassword(password);
          const current = Number.isFinite(goalCurrent ?? NaN) ? Number(goalCurrent) : 0;
          const target = Number.isFinite(goalTarget ?? NaN) ? Number(goalTarget) : 0;
          const start = Number.isFinite(goalStart ?? NaN) ? Number(goalStart) : current;
          // If the initial state happens to already score 100 (e.g. defaults
          // all 0, or start==target==current), pre-mark celebrated=true so
          // the CelebrationWatcher never mistakes the "brand new" state for a
          // real achievement transition.
          const initialScore = goalScore({
            id: '',
            teamId,
            name: trimmed,
            passwordHash: '',
            goalType: goalType ?? 'weight',
            goalStart: start,
            goalTarget: target,
            goalCurrent: current,
            goalUnit: '',
            tourCompleted: false,
            celebrated: false,
            isLeader,
            createdAt: '',
          });
          const celebrated = initialScore === 100;
          const { data, error } = await supabase
            .from('members')
            .insert({
              team_id: teamId,
              name: trimmed,
              password_hash: hash,
              goal_type: goalType ?? 'weight',
              goal_start: start,
              goal_target: target,
              goal_current: current,
              goal_unit: (goalUnit && goalUnit.trim()) || GOAL_TYPE_DEFAULT_UNIT[goalType ?? 'weight'],
              is_leader: isLeader,
              celebrated,
            })
            .select()
            .single();
          if (error || !data) {
            console.error('[signup]', error);
            return { ok: false, reason: 'network' };
          }
          const m = rowToMember(data);
          set((s) => ({
            members: [...s.members.filter((x) => x.id !== m.id), m],
            currentMemberId: m.id,
          }));
          return { ok: true };
        },

        login: async (name, password) => {
          const teamId = get().currentTeamId;
          if (!teamId) return { ok: false, reason: 'team-not-found' };
          const trimmed = name.trim();
          if (!trimmed) return { ok: false, reason: 'name-empty' };
          if (!password) return { ok: false, reason: 'password-empty' };
          const { data, error } = await supabase
            .from('members')
            .select('*')
            .eq('team_id', teamId);
          if (error) {
            console.error('[login]', error);
            return { ok: false, reason: 'network' };
          }
          const member = (data ?? []).find(
            (m) => normalizeName(m.name) === normalizeName(trimmed)
          );
          if (!member) return { ok: false, reason: 'not-found' };
          const hash = await hashPassword(password);
          if (hash !== member.password_hash) return { ok: false, reason: 'wrong-password' };
          set({ currentMemberId: member.id });
          return { ok: true };
        },

        logout: () => set({ currentMemberId: null }),

        updateMyProfile: async (patch) => {
          const id = get().currentMemberId;
          if (!id) return;
          const prev = get().members.find((m) => m.id === id);
          if (!prev) return;
          const prevScore = goalScore(prev);

          // Build the candidate next state, applying the same brand-new
          // member auto-correction GoalsPage already does defensively:
          // if the member has never set a starting value (start == current)
          // or is a brand-new zeroed profile (start == 0 && current == 0),
          // and the user is now entering a real current value, quietly set
          // goalStart = new goalCurrent so the formula doesn't falsely
          // report 100% because of stale zeros.
          let nextGoalStart = patch.goalStart !== undefined ? patch.goalStart : prev.goalStart;
          const nextGoalCurrent =
            patch.goalCurrent !== undefined ? patch.goalCurrent : prev.goalCurrent;
          const nextGoalTarget =
            patch.goalTarget !== undefined ? patch.goalTarget : prev.goalTarget;

          const isBrandNewStart =
            (prev.goalStart === 0 && prev.goalCurrent === 0) ||
            prev.goalStart === prev.goalCurrent;
          const userDidNotTouchStart = patch.goalStart === undefined;
          if (
            isBrandNewStart &&
            userDidNotTouchStart &&
            patch.goalCurrent !== undefined &&
            patch.goalCurrent !== prev.goalStart
          ) {
            nextGoalStart = patch.goalCurrent;
          }

          const nextMember: Member = {
            ...prev,
            ...(patch.name !== undefined ? { name: patch.name.trim() } : null),
            ...(patch.goalType !== undefined ? { goalType: patch.goalType } : null),
            ...(patch.goalUnit !== undefined ? { goalUnit: patch.goalUnit } : null),
            goalStart: nextGoalStart,
            goalCurrent: nextGoalCurrent,
            goalTarget: nextGoalTarget,
          };
          const nextScore = goalScore(nextMember);

          // Real "achievement transition" = prevScore < 100 AND nextScore === 100
          // AND the user actually touched goalCurrent in this update.
          // Anything else reaching 100 (target edits, stale-zero defaults,
          // already-celebrated edits) must be suppressed silently.
          const isRealAchievement =
            prevScore < 100 &&
            nextScore === 100 &&
            patch.goalCurrent !== undefined;
          const shouldAutoCelebrate = nextScore === 100 && !isRealAchievement;

          const payload: Record<string, unknown> = {};
          if (patch.name !== undefined) payload.name = patch.name.trim();
          if (patch.goalType !== undefined) payload.goal_type = patch.goalType;
          payload.goal_start = nextGoalStart;
          if (patch.goalTarget !== undefined) payload.goal_target = patch.goalTarget;
          if (patch.goalCurrent !== undefined) payload.goal_current = patch.goalCurrent;
          if (patch.goalUnit !== undefined) payload.goal_unit = patch.goalUnit;
          if (shouldAutoCelebrate && !prev.celebrated) {
            payload.celebrated = true;
          }

          const { data, error } = await supabase
            .from('members')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
          if (error) {
            console.error('[updateMyProfile]', error);
            throw error;
          }
          if (data) {
            const m = rowToMember(data);
            // Preserve local celebrated=true if a realtime race could reset it.
            const merged: Member =
              prev.celebrated && !m.celebrated ? { ...m, celebrated: true } : m;
            set((s) => ({ members: s.members.map((x) => (x.id === m.id ? merged : x)) }));
          }
        },

        removeMyself: async () => {
          const id = get().currentMemberId;
          if (!id) return;
          const { error } = await supabase.from('members').delete().eq('id', id);
          if (error) {
            console.error('[removeMyself]', error);
            throw error;
          }
          set((s) => ({
            members: s.members.filter((m) => m.id !== id),
            certifications: s.certifications.filter((c) => c.memberId !== id),
            currentMemberId: null,
          }));
        },

        addCertification: async ({ imageDataUrl, caption, certDate }) => {
          const teamId = get().currentTeamId;
          const memberId = get().currentMemberId;
          if (!teamId || !memberId) return;
          const insertPayload: Record<string, unknown> = {
            team_id: teamId,
            member_id: memberId,
            image_data_url: imageDataUrl,
            caption: caption ?? null,
          };
          if (certDate) {
            // Store as noon local time to avoid timezone-boundary issues
            const d = new Date(certDate + 'T12:00:00');
            insertPayload.created_at = d.toISOString();
          }
          const { data, error } = await supabase
            .from('certifications')
            .insert(insertPayload)
            .select()
            .single();
          if (error) {
            console.error('[addCertification]', error);
            throw new Error(error.message);
          }
          if (data) {
            const cert = rowToCert(data);
            set((s) => ({
              certifications: [
                cert,
                ...s.certifications.filter((c) => c.id !== cert.id),
              ],
            }));
          }
        },

        updateMyCertification: async (id, patch) => {
          const memberId = get().currentMemberId;
          if (!memberId) return;
          const target = get().certifications.find((c) => c.id === id);
          if (!target || target.memberId !== memberId) return;
          const { data, error } = await supabase
            .from('certifications')
            .update({ caption: patch.caption ?? null })
            .eq('id', id)
            .select()
            .single();
          if (error) {
            console.error('[updateMyCertification]', error);
            throw error;
          }
          if (data) {
            const cert = rowToCert(data);
            set((s) => ({
              certifications: s.certifications.map((c) => (c.id === cert.id ? cert : c)),
            }));
          }
        },

        removeMyCertification: async (id) => {
          const memberId = get().currentMemberId;
          if (!memberId) return;
          const target = get().certifications.find((c) => c.id === id);
          if (!target || target.memberId !== memberId) return;
          const { error } = await supabase.from('certifications').delete().eq('id', id);
          if (error) {
            console.error('[removeMyCertification]', error);
            throw error;
          }
          set((s) => ({
            certifications: s.certifications.filter((c) => c.id !== id),
          }));
        },

        setTeamChallenge: async (c) => {
          const teamId = get().currentTeamId;
          if (!teamId) return;
          const payload = {
            team_id: teamId,
            title: c.title,
            target_count: c.targetCount,
            theme_emoji: c.themeEmoji,
            start_date: c.startDate,
            end_date: c.endDate,
          };
          const { data, error } = await supabase
            .from('team_challenges')
            .upsert(payload, { onConflict: 'team_id' })
            .select()
            .single();
          if (error) {
            console.error('[setTeamChallenge]', error);
            throw error;
          }
          if (data) set({ teamChallenge: rowToChallenge(data) });
        },

        deleteTeamChallenge: async () => {
          const teamId = get().currentTeamId;
          if (!teamId) return;
          const { error } = await supabase.from('team_challenges').delete().eq('team_id', teamId);
          if (error) {
            console.error('[deleteTeamChallenge]', error);
            throw error;
          }
          set({ teamChallenge: null });
        },

        markTourCompleted: async () => {
          const id = get().currentMemberId;
          if (!id) return;
          // Optimistic local update so the overlay closes instantly.
          set((s) => ({
            members: s.members.map((m) =>
              m.id === id ? { ...m, tourCompleted: true } : m
            ),
          }));
          const { error } = await supabase
            .from('members')
            .update({ tour_completed: true })
            .eq('id', id);
          if (error) console.error('[markTourCompleted]', error);
        },

        markCelebrated: async (memberId) => {
          // Optimistic so repeated renders don't re-trigger the modal.
          set((s) => ({
            members: s.members.map((m) =>
              m.id === memberId ? { ...m, celebrated: true } : m
            ),
          }));
          const { error } = await supabase
            .from('members')
            .update({ celebrated: true })
            .eq('id', memberId);
          if (error) console.error('[markCelebrated]', error);
        },

        hydrate: async () => {
          const teamId = get().currentTeamId;
          if (!teamId) return;
          setCache({ loading: true, error: null });
          const [teamRes, membersRes, certsRes, chalRes] = await Promise.all([
            supabase.from('teams').select('id').eq('id', teamId).maybeSingle(),
            supabase.from('members').select('*').eq('team_id', teamId).order('created_at'),
            supabase.from('certifications').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
            supabase.from('team_challenges').select('*').eq('team_id', teamId).maybeSingle(),
          ]);
          if (membersRes.error || certsRes.error || chalRes.error) {
            console.error('[hydrate]', membersRes.error, certsRes.error, chalRes.error);
            setCache({ loading: false, error: '팀 데이터를 불러오지 못했어요' });
            return;
          }
          // Session can go stale when the server drops a team or a member
          // out from under the persisted localStorage state (DB reset, admin
          // removal, etc.). Foreign-key writes like addCertification silently
          // fail in that state, so clear the stale ids and let the route
          // guards bounce the user to /team or /login.
          if (!teamRes.data) {
            set({
              currentTeamId: null,
              currentTeamCode: null,
              currentTeamName: null,
              currentMemberId: null,
              members: [],
              certifications: [],
              teamChallenge: null,
              loading: false,
              error: null,
            });
            return;
          }
          const members = (membersRes.data ?? []).map(rowToMember);
          const currentMemberId = get().currentMemberId;
          const staleMember =
            !!currentMemberId && !members.some((m) => m.id === currentMemberId);
          set({
            members,
            certifications: (certsRes.data ?? []).map(rowToCert),
            teamChallenge: chalRes.data ? rowToChallenge(chalRes.data) : null,
            loading: false,
            error: null,
            ...(staleMember ? { currentMemberId: null } : {}),
          });
          subscribeRealtime(teamId);
        },

        getCurrentMember: () => {
          const id = get().currentMemberId;
          return id ? get().members.find((m) => m.id === id) : undefined;
        },
      };
    },
    {
      name: 'teamfit-session-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentTeamId: state.currentTeamId,
        currentTeamCode: state.currentTeamCode,
        currentTeamName: state.currentTeamName,
        currentMemberId: state.currentMemberId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.currentTeamId) {
          // Fire-and-forget hydrate after rehydrate to refill caches.
          setTimeout(() => {
            useTeamStore.getState().hydrate();
          }, 0);
        }
      },
    }
  )
);
