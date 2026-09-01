import React, { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
      
      {/* Main Content Area */}
      <main className="lg:ml-64 mt-16 p-4 pb-24 md:p-8 md:pb-8 bg-gray-50 dark:bg-gray-800 min-h-[calc(100vh-4rem)] transition-colors w-full lg:w-[calc(100%-16rem)]">
        {children}
      </main>

      <BottomNav />
    </div>
  );
};
