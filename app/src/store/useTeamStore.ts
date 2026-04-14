import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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

export type Member = {
  id: string;
  name: string;
  goalType: GoalType;
  goalStart: number;
  goalTarget: number;
  goalCurrent: number;
  goalUnit: string;
};

export type Certification = {
  id: string;
  memberId: string;
  imageDataUrl: string;
  caption?: string;
  createdAt: string;
};

export type TeamChallenge = {
  id: string;
  title: string;
  targetCount: number;
  themeEmoji: string;
  startDate: string; // ISO date yyyy-mm-dd
  endDate: string;   // ISO date yyyy-mm-dd
};

export interface TeamState {
  currentUser: string | null;
  members: Member[];
  certifications: Certification[];
  celebratedMemberIds: string[];
  teamChallenge: TeamChallenge | null;
  login: (name: string) => void;
  logout: () => void;
  addMember: (m: Omit<Member, 'id'>) => Member;
  updateMember: (id: string, patch: Partial<Omit<Member, 'id'>>) => void;
  removeMember: (id: string) => void;
  addCertification: (c: Omit<Certification, 'id' | 'createdAt'>) => Certification;
  updateCertification: (id: string, patch: Partial<Omit<Certification, 'id' | 'createdAt' | 'memberId'>>) => void;
  removeCertification: (id: string) => void;
  getMemberByName: (name: string) => Member | undefined;
  ensureMemberForUser: (name: string) => Member;
  markCelebrated: (memberId: string) => void;
  setTeamChallenge: (c: TeamChallenge | null) => void;
}

function computeGoalScore(m: Member): number {
  const target = Number.isFinite(m.goalTarget) ? m.goalTarget : 0;
  const current = Number.isFinite(m.goalCurrent) ? m.goalCurrent : 0;
  const start = Number.isFinite(m.goalStart) ? m.goalStart : current;
  const diff = target - start;
  if (!Number.isFinite(diff) || Math.abs(diff) < 1e-9) return 0;
  const pct = ((current - start) / diff) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      members: [],
      certifications: [],
      celebratedMemberIds: [],
      teamChallenge: null,

      login: (name) => set({ currentUser: name.trim() }),
      logout: () => set({ currentUser: null }),

      addMember: (m) => {
        const goalCurrent = Number.isFinite(m.goalCurrent) ? m.goalCurrent : 0;
        const goalStart = Number.isFinite(m.goalStart) ? m.goalStart : goalCurrent;
        const newMember: Member = {
          id: uuid(),
          name: m.name.trim(),
          goalType: m.goalType ?? 'weight',
          goalStart,
          goalTarget: Number.isFinite(m.goalTarget) ? m.goalTarget : 0,
          goalCurrent,
          goalUnit: m.goalUnit || '',
        };
        set((s) => ({ members: [...s.members, newMember] }));
        return newMember;
      },

      updateMember: (id, patch) =>
        set((s) => {
          const members = s.members.map((m) => (m.id === id ? { ...m, ...patch } : m));
          const next = members.find((m) => m.id === id);
          const celebratedMemberIds = s.celebratedMemberIds.filter((cid) => {
            if (cid !== id || !next) return true;
            return computeGoalScore(next) === 100;
          });
          return { members, celebratedMemberIds };
        }),

      removeMember: (id) =>
        set((s) => ({
          members: s.members.filter((m) => m.id !== id),
          certifications: s.certifications.filter((c) => c.memberId !== id),
          celebratedMemberIds: s.celebratedMemberIds.filter((cid) => cid !== id),
        })),

      addCertification: (c) => {
        const cert: Certification = {
          id: uuid(),
          memberId: c.memberId,
          imageDataUrl: c.imageDataUrl,
          caption: c.caption,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ certifications: [...s.certifications, cert] }));
        return cert;
      },

      updateCertification: (id, patch) =>
        set((s) => ({
          certifications: s.certifications.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          ),
        })),

      removeCertification: (id) =>
        set((s) => ({
          certifications: s.certifications.filter((c) => c.id !== id),
        })),

      getMemberByName: (name) => {
        const trimmed = name.trim().toLowerCase();
        return get().members.find((m) => m.name.trim().toLowerCase() === trimmed);
      },

      ensureMemberForUser: (name) => {
        const existing = get().getMemberByName(name);
        if (existing) return existing;
        return get().addMember({
          name,
          goalType: 'weight',
          goalStart: 0,
          goalTarget: 0,
          goalCurrent: 0,
          goalUnit: 'kg',
        });
      },

      markCelebrated: (memberId) =>
        set((s) =>
          s.celebratedMemberIds.includes(memberId)
            ? s
            : { celebratedMemberIds: [...s.celebratedMemberIds, memberId] }
        ),

      setTeamChallenge: (c) => set({ teamChallenge: c }),
    }),
    {
      name: 'teamfit-v1',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentUser: state.currentUser,
        members: state.members,
        certifications: state.certifications,
        celebratedMemberIds: state.celebratedMemberIds,
        teamChallenge: state.teamChallenge,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState ?? {}) as Record<string, unknown>;
        if (version < 2) {
          if (Array.isArray(state.members)) {
            state.members = (state.members as Array<Record<string, unknown>>).map((m) => ({
              goalType: 'weight',
              ...m,
            }));
          }
          if (!Array.isArray(state.celebratedMemberIds)) state.celebratedMemberIds = [];
          if (!('teamChallenge' in state)) state.teamChallenge = null;
        }
        if (version < 3) {
          if (Array.isArray(state.members)) {
            state.members = (state.members as Array<Record<string, unknown>>).map((m) => {
              const current = typeof m.goalCurrent === 'number' ? m.goalCurrent : 0;
              return { ...m, goalStart: typeof m.goalStart === 'number' ? m.goalStart : current };
            });
          }
          // Reset celebration state — previous entries were based on the buggy formula.
          state.celebratedMemberIds = [];
        }
        return state as unknown as TeamState;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('[teamfit] rehydrate failed, resetting', error);
          try {
            localStorage.removeItem('teamfit-v1');
          } catch {
            // ignore
          }
          return;
        }
        if (!state) return;
        // Sanity guards
        if (!Array.isArray(state.members)) state.members = [];
        if (!Array.isArray(state.certifications)) state.certifications = [];
        if (!Array.isArray(state.celebratedMemberIds)) state.celebratedMemberIds = [];
        // Ensure goalType + goalStart on each member (defensive, in case migrate was skipped)
        state.members = state.members.map((m) => {
          const mm = m as Member;
          return {
            ...m,
            goalType: mm.goalType ?? 'weight',
            goalStart:
              typeof mm.goalStart === 'number' && Number.isFinite(mm.goalStart)
                ? mm.goalStart
                : mm.goalCurrent,
          };
        });
        if (typeof state.teamChallenge === 'undefined') state.teamChallenge = null;
      },
    }
  )
);
