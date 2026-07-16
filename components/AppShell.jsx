'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import RegisterSW from './RegisterSW';
import { RefreshProvider } from '../lib/refresh';
import styles from './AppShell.module.css';

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <RefreshProvider>
      <div className={styles.shell}>
        <Sidebar
          collapsed={collapsed}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
        />
        <div className={styles.shellMain}>
          <TopBar
            onToggleSidebar={() => setCollapsed((c) => !c)}
            onOpenDrawer={() => setDrawerOpen(true)}
          />
          <main className={styles.shellContent}>{children}</main>
        </div>
      </div>
      <RegisterSW />
    </RefreshProvider>
  );
}
