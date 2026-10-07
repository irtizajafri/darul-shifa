import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import TabsContainer from './TabsContainer';
import CommandPalette from '../shared/CommandPalette';
import { ConfirmDialogHost } from '../ui/ConfirmDialog';

// Browsers change a focused <input type="number">'s value when the mouse
// wheel scrolls over it. On money/quantity fields that silently alters an
// amount the user has already typed. Blurring the input before the default
// action runs cancels the change; the page still scrolls normally. One
// global listener covers every number input in the app (150+), including
// ones added later, instead of an onWheel prop on each.
function useNumberInputWheelGuard() {
  useEffect(() => {
    const onWheel = (e) => {
      const el = document.activeElement;
      if (el && el.tagName === 'INPUT' && el.type === 'number' && el.contains(e.target)) {
        el.blur();
      }
    };
    document.addEventListener('wheel', onWheel, { passive: true });
    return () => document.removeEventListener('wheel', onWheel);
  }, []);
}

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed] = useState(false); // collapsed rail is not wired up yet
  useNumberInputWheelGuard();

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
      <ConfirmDialogHost />
    </div>
  );
}
