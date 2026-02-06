import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Settings</h1>
        <p className="text-sm text-[var(--text-tertiary)]">Manage your account and API keys</p>
      </div>

      <Card className="space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">API Keys</h2>
        <div className="space-y-3">
          <SettingRow label="Anthropic API Key" value="sk-ant-••••••••" />
          <SettingRow label="Tavily API Key" value="tvly-••••••••" />
        </div>
        <Button variant="secondary" size="sm">Update Keys</Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Agent Defaults</h2>
        <div className="space-y-3">
          <SettingRow label="Default min profit" value="$20.00" />
          <SettingRow label="Default risk tolerance" value="Medium" />
          <SettingRow label="Default region" value="US" />
        </div>
        <Button variant="secondary" size="sm">Edit Defaults</Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Notifications</h2>
        <div className="space-y-3">
          <SettingRow label="High-confidence alerts" value="Enabled" />
          <SettingRow label="Morning briefing" value="8:00 AM" />
          <SettingRow label="Price change alerts" value="Enabled" />
        </div>
        <Button variant="secondary" size="sm">Edit Notifications</Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Account</h2>
        <div className="space-y-3">
          <SettingRow label="Email" value="ben@example.com" />
          <SettingRow label="Plan" value="Free" />
        </div>
      </Card>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="text-[var(--text-primary)] font-mono-numbers">{value}</span>
    </div>
  );
}
