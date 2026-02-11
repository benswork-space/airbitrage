import { Sidebar } from '@/components/dashboard/sidebar';
import { AgentTabBar } from '@/components/dashboard/agent-tab-bar';
import { AgentRunProvider } from '@/components/providers/agent-run-provider';
import { PasswordGate } from '@/components/shared/password-gate';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PasswordGate>
      <AgentRunProvider>
        <div className="min-h-screen">
          <Sidebar />
          <div style={{ marginLeft: 'var(--sidebar-width)' }}>
            <AgentTabBar />
            <main className="p-6">
              {children}
            </main>
          </div>
        </div>
      </AgentRunProvider>
    </PasswordGate>
  );
}
