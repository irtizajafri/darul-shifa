import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import TabsContainer from './TabsContainer';
import CommandPalette from '../shared/CommandPalette';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
      />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <TabsContainer />
      </div>
      <CommandPalette />
    </div>
  );
}
