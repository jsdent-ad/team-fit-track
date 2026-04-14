import { NavLink } from 'react-router-dom';

type Tab = {
  to: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const tabs: Tab[] = [
  {
    to: '/',
    label: '랭킹',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 21V10M12 21V3M20 21V14"
          stroke={a ? '#0066FF' : '#6B7280'}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    to: '/certify',
    label: '인증',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 7h3l2-2h6l2 2h3a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"
          stroke={a ? '#0066FF' : '#6B7280'}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="13" r="3.5" stroke={a ? '#0066FF' : '#6B7280'} strokeWidth="2" />
      </svg>
    ),
  },
  {
    to: '/records',
    label: '기록',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 4h11l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"
          stroke={a ? '#0066FF' : '#6B7280'}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M8 11h8M8 15h8M8 7h5" stroke={a ? '#0066FF' : '#6B7280'} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/goals',
    label: '목표',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke={a ? '#0066FF' : '#6B7280'} strokeWidth="2" />
        <circle cx="12" cy="12" r="4" stroke={a ? '#0066FF' : '#6B7280'} strokeWidth="2" />
        <circle cx="12" cy="12" r="1" fill={a ? '#0066FF' : '#6B7280'} />
      </svg>
    ),
  },
];

export default function BottomTabs() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="주요 네비게이션"
    >
      <ul className="flex items-stretch justify-around max-w-xl mx-auto">
        {tabs.map((t) => (
          <li key={t.to} className="flex-1" data-tab={t.to}>
            <NavLink
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-0.5 h-16 min-w-[48px] transition-colors active:scale-95',
                  isActive ? 'text-accent font-semibold' : 'text-neutral-500',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {t.icon(isActive)}
                  <span className="text-xs">{t.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
