import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Compass, Map, Settings, Users } from 'lucide-react';

export function BottomNav() {
  const { t } = useTranslation();

  const navItems = [
    { to: '/dashboard', icon: Home, label: t('nav.home', 'Home') },
    { to: '/destinations', icon: Compass, label: t('nav.explore', 'Explore') },
    { to: '/group', icon: Users, label: t('nav.group', 'Group') },
    { to: '/maps', icon: Map, label: t('nav.maps', 'Map') },
    { to: '/profile', icon: Settings, label: t('nav.profile', 'Profile') },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 flex justify-between items-center z-50 pb-safe">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 w-16 ${
              isActive
                ? 'text-orange-600 font-semibold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`
          }
        >
          <item.icon size={22} className="mb-1" strokeWidth={2.5} />
          <span className="text-[10px] whitespace-nowrap">{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}
