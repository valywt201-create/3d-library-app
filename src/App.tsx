import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import SpaceBackground from './components/SpaceBackground'
import AppHeader from './components/AppHeader'
import TreeSidebar from './components/TreeSidebar'
import AIAssistant from './components/AIAssistant'
import SettingsModal from './components/SettingsModal'
import { LibraryProvider, TreeProvider, useTree } from './shared'
import { resolveAccent, useSettings } from './lib/settings'

function Layout() {
  const { accent: branchAccent } = useTree() // لون الفرع النشط
  const settings = useSettings()              // الإعدادات المحفوظة (الثيم، الزجاج، لون التوهّج)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const openSettings = useCallback((): void => setSettingsOpen(true), [])
  const closeSettings = useCallback((): void => setSettingsOpen(false), [])

  // اللون الفعلي: المخصّص إن اختاره المستخدم، وإلا لون الفرع النشط
  const accent = resolveAccent(settings, branchAccent)

  return (
    // --accent متغير CSS يصل الخلفية الثابتة وأي عنصر يستخدم لون التوهّج
    <div dir="rtl" className="min-h-screen" style={{ '--accent': accent } as CSSProperties}>
      {/* خلفية التطبيق بحسب الثيم: حيّة (WebGL) أو ثابتة (CSS) أو داكنة سادة بلا خلفية */}
      {settings.theme === 'space-live' && <SpaceBackground color={accent} />}
      {settings.theme === 'space-static' && <div className="space-static" aria-hidden />}

      <AppHeader accent={accent} onOpenSettings={openSettings} />
      <TreeSidebar />
      <AIAssistant />

      {/* نافذة الإعدادات: تُفتح بزر الترس في الترويسة */}
      <SettingsModal open={settingsOpen} onClose={closeSettings} />
    </div>
  )
}

export default function App() {
  return (
    <LibraryProvider>
      <TreeProvider>
        <Layout />
      </TreeProvider>
    </LibraryProvider>
  )
}