import { Monitor, Moon, Palette, Sun } from 'lucide-react'
import { useTheme } from '../hooks/theme'
import { PageHeading } from '../components/PageHeading'

const appearances = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function SettingsPage() {
  const { preference, setPreference } = useTheme()

  return (
    <>
      <PageHeading title="Settings" description="Manage your display preferences and view application information." />
      <div className="mt-6 max-w-3xl space-y-5">
        <section className="panel" aria-labelledby="appearance-title">
          <div className="panel-heading">
            <h2 id="appearance-title" className="flex items-center gap-2 font-semibold">
              <Palette aria-hidden="true" size={17} className="text-accent" /> Appearance
            </h2>
          </div>
          <fieldset className="px-5 py-5">
            <legend className="sr-only">Color theme</legend>
            <p className="mb-4 text-sm text-muted">Your theme is saved in this browser. System follows your device.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {appearances.map(({ value, label, icon: Icon }) => (
                <label key={value} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:bg-raised has-checked:border-accent has-checked:bg-raised">
                  <input type="radio" name="theme" value={value} checked={preference === value} onChange={() => setPreference(value)} className="size-4 accent-accent" />
                  <Icon aria-hidden="true" size={16} className="text-muted" />{label}
                </label>
              ))}
            </div>
          </fieldset>
        </section>
        <section className="panel" aria-labelledby="about-title">
          <div className="panel-heading"><h2 id="about-title" className="font-semibold">About OpsPilot</h2></div>
          <dl className="divide-y divide-line px-5 text-sm">
            <div className="flex flex-wrap justify-between gap-2 py-4">
              <dt className="text-muted">Purpose</dt><dd>Endpoint monitoring and incident management</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-4">
              <dt className="text-muted">Dashboard refresh</dt><dd>Every 5 seconds while visible</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  )
}
