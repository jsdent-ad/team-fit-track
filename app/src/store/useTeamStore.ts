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
  // auth — null means legacy member without credentials, new signup can claim it
  passwordHash: string | null;
  goalType: GoalType;
  goalStart: number;
  goalTarget: number;
  goalCurrent: number;
  goalUnit: string;
  createdAt: string;
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
  startDate: string;
  endDate: string;
};

export type AuthResult =
  | { ok: true; member: Member }
  | { ok: false; reason: 'name-empty' | 'password-empty' | 'not-found' | 'wrong-password' | 'already-exists' | 'name-conflict' | 'password-mismatch' };

export interface TeamState {
  currentMemberId: string | null;
  members: Member[];
  certifications: Certification[];
  celebratedMemberIds: string[];
  tourCompletedMemberIds: string[];
  teamChallenge: TeamChallenge | null;

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
  claimLegacy: (name: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<AuthResult>;

  // Members (only current user can mutate their own, enforced in UI)
  updateMember: (id: string, patch: Partial<Omit<Member, 'id' | 'passwordHash' | 'createdAt'>>) => void;
  removeMember: (id: string) => void;

  // Certifications
  addCertification: (c: Omit<Certification, 'id' | 'createdAt'>) => Certification;
  updateCertification: (id: string, patch: Partial<Omit<Certification, 'id' | 'createdAt' | 'memberId'>>) => void;
  removeCertification: (id: string) => void;

  // Helpers
  getCurrentMember: () => Member | undefined;
  getMemberByName: (name: string) => Member | undefined;
  markCelebrated: (memberId: string) => void;
  markTourCompleted: (memberId: string) => void;
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

// Browser-only SHA-256 via SubtleCrypto. Not real security (still localStorage),
// but prevents trivial plaintext exposure when inspecting storage.
async function hashPassword(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeName(n: string): string {
  return n.trim().toLowerCase();
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      currentMemberId: null,
      members: [],
      certifications: [],
      celebratedMemberIds: [],
      tourCompletedMemberIds: [],
      teamChallenge: null,

      signup: async ({ name, password, goalType, goalStart, goalTarget, goalCurrent, goalUnit }) => {
        const trimmedName = name.trim();
        if (!trimmedName) return { ok: false, reason: 'name-empty' };
        if (!password) return { ok: false, reason: 'password-empty' };
        const existing = get().members.find((m) => normalizeName(m.name) === normalizeName(trimmedName));
        if (existing && existing.passwordHash) {
          return { ok: false, reason: 'already-exists' };
        }
        const hash = await hashPassword(password);
        if (existing && !existing.passwordHash) {
          // Legacy member takeover via signup path
          const updated: Member = { ...existing, passwordHash: hash };
          set((s) => ({
            members: s.members.map((m) => (m.id === existing.id ? updated : m)),
            currentMemberId: existing.id,
          }));
          return { ok: true, member: updated };
        }
        const current = Number.isFinite(goalCurrent ?? NaN) ? (goalCurrent as number) : 0;
        const start = Number.isFinite(goalStart ?? NaN) ? (goalStart as number) : current;
        const newMember: Member = {
          id: uuid(),
          name: trimmedName,
          passwordHash: hash,
          goalType: goalType ?? 'weight',
          goalStart: start,
          goalTarget: Number.isFinite(goalTarget ?? NaN) ? (goalTarget as number) : 0,
          goalCurrent: current,
          goalUnit: (goalUnit && goalUnit.trim()) || GOAL_TYPE_DEFAULT_UNIT[goalType ?? 'weight'],
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          members: [...s.members, newMember],
          currentMemberId: newMember.id,
        }));
        return { ok: true, member: newMember };
      },

      login: async (name, password) => {
        const trimmedName = name.trim();
        if (!trimmedName) return { ok: false, reason: 'name-empty' };
        if (!password) return { ok: false, reason: 'password-empty' };
        const member = get().members.find(
          (m) => normalizeName(m.name) === normalizeName(trimmedName)
        );
        if (!member) return { ok: false, reason: 'not-found' };
        if (!member.passwordHash) {
          // Legacy member — must go through claimLegacy path
          return { ok: false, reason: 'not-found' };
        }
        const hash = await hashPassword(password);
        if (hash !== member.passwordHash) {
          return { ok: false, reason: 'wrong-password' };
        }
        set({ currentMemberId: member.id });
        return { ok: true, member };
      },

      claimLegacy: async (name, password) => {
        const trimmedName = name.trim();
        if (!trimmedName) return { ok: false, reason: 'name-empty' };
        if (!password) return { ok: false, reason: 'password-empty' };
        const member = get().members.find(
          (m) => normalizeName(m.name) === normalizeName(trimmedName)
        );
        if (!member) return { ok: false, reason: 'not-found' };
        if (member.passwordHash) return { ok: false, reason: 'already-exists' };
        const hash = await hashPassword(password);
        const updated: Member = { ...member, passwordHash: hash };
        set((s) => ({
          members: s.members.map((m) => (m.id === member.id ? updated : m)),
          currentMemberId: updated.id,
        }));
        return { ok: true, member: updated };
      },

      logout: () => set({ currentMemberId: null }),

      changePassword: async (oldPassword, newPassword) => {
        const id = get().currentMemberId;
        if (!id) return { ok: false, reason: 'not-found' };
        const member = get().members.find((m) => m.id === id);
        if (!member || !member.passwordHash) return { ok: false, reason: 'not-found' };
        if (!newPassword) return { ok: false, reason: 'password-empty' };
        const oldHash = await hashPassword(oldPassword);
        if (oldHash !== member.passwordHash) return { ok: false, reason: 'wrong-password' };
        const hash = await hashPassword(newPassword);
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, passwordHash: hash } : m)),
        }));
        return { ok: true, member: { ...member, passwordHash: hash } };
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
          currentMemberId: s.currentMemberId === id ? null : s.currentMemberId,
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
          certifications: s.certifications.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeCertification: (id) =>
        set((s) => ({
          certifications: s.certifications.filter((c) => c.id !== id),
        })),

      getCurrentMember: () => {
        const id = get().currentMemberId;
        return id ? get().members.find((m) => m.id === id) : undefined;
      },

      getMemberByName: (name) => {
        const trimmed = normalizeName(name);
        return get().members.find((m) => normalizeName(m.name) === trimmed);
      },

      markCelebrated: (memberId) =>
        set((s) =>
          s.celebratedMemberIds.includes(memberId)
            ? s
            : { celebratedMemberIds: [...s.celebratedMemberIds, memberId] }
        ),

      markTourCompleted: (memberId) =>
        set((s) =>
          s.tourCompletedMemberIds.includes(memberId)
            ? s
            : { tourCompletedMemberIds: [...s.tourCompletedMemberIds, memberId] }
        ),

      setTeamChallenge: (c) => set({ teamChallenge: c }),
    }),
    {
      name: 'teamfit-v1',
      version: 4,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentMemberId: state.currentMemberId,
        members: state.members,
        certifications: state.certifications,
        celebratedMemberIds: state.celebratedMemberIds,
        tourCompletedMemberIds: state.tourCompletedMemberIds,
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
          state.celebratedMemberIds = [];
        }
        if (version < 4) {
          // v3 used currentUser (name string); v4 uses currentMemberId
          if (Array.isArray(state.members)) {
            state.members = (state.members as Array<Record<string, unknown>>).map((m) => ({
              passwordHash: null,
              createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
              ...m,
            }));
            // Map legacy currentUser (name) to matching member id if possible
            const currentUserName = typeof state.currentUser === 'string' ? state.currentUser.trim().toLowerCase() : '';
            const match = (state.members as Array<{ id: string; name: string }>).find(
              (m) => m.name.trim().toLowerCase() === currentUserName
            );
            state.currentMemberId = match ? match.id : null;
          } else {
            state.currentMemberId = null;
          }
          delete state.currentUser;
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
        if (!Array.isArray(state.members)) state.members = [];
        if (!Array.isArray(state.certifications)) state.certifications = [];
        if (!Array.isArray(state.celebratedMemberIds)) state.celebratedMemberIds = [];
        if (!Array.isArray(state.tourCompletedMemberIds)) state.tourCompletedMemberIds = [];
        state.members = state.members.map((m) => {
          const mm = m as Member;
          return {
            ...m,
            goalType: mm.goalType ?? 'weight',
            goalStart:
              typeof mm.goalStart === 'number' && Number.isFinite(mm.goalStart)
                ? mm.goalStart
                : mm.goalCurrent,
            passwordHash: typeof mm.passwordHash === 'string' ? mm.passwordHash : null,
            createdAt: typeof mm.createdAt === 'string' ? mm.createdAt : new Date().toISOString(),
          };
        });
        // Ensure current id still exists
        if (state.currentMemberId && !state.members.some((m) => m.id === state.currentMemberId)) {
          state.currentMemberId = null;
        }
        if (typeof state.teamChallenge === 'undefined') state.teamChallenge = null;
      },
    }
  )
);
