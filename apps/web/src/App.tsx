import { Route, Routes } from 'react-router-dom'
import { EmployeesPage } from './routes/EmployeesPage'
import { PlansPage } from './routes/PlansPage'
import { SettingsPage } from './routes/SettingsPage'
import { AccountPage } from './routes/AccountPage'
import { PlanLayout } from './routes/plans/PlanLayout'
import { ShiftsPage } from './routes/plans/ShiftsPage'
import { HeadcountPage } from './routes/plans/HeadcountPage'
import { LeavesPage } from './routes/plans/LeavesPage'
import { Nav } from './components/Nav'
import { Button } from './components/ui/Button'
import { AppStateProvider, useAppDispatch, useAppState } from './state/AppStateContext'
import { AuthProvider } from './state/AuthContext'
import { useBeforeUnloadGuard } from './hooks/useBeforeUnloadGuard'
import { useUndoShortcut } from './hooks/useUndoShortcut'
import { useCloudSync } from './hooks/useCloudSync'
import { exportStateJson } from './lib/io/exportStateJson'

function AppShell() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { showSaveReminder, dismissSaveReminder } = useBeforeUnloadGuard(state.meta.isDirty)
  useUndoShortcut(dispatch)
  useCloudSync()

  function handleSaveFromReminder() {
    exportStateJson(state)
    dispatch({ type: 'MARK_SAVED' })
    dismissSaveReminder()
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />
      {showSaveReminder && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm text-amber-800">
              編集中の内容はまだ保存されていません。閉じる前に保存しておくと、次回「読み込み」から続きを再開できます。
            </p>
            <div className="flex items-center gap-3">
              <Button type="button" onClick={handleSaveFromReminder}>
                保存(ファイル)
              </Button>
              <button type="button" onClick={dismissSaveReminder} className="text-sm text-amber-700 hover:underline">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<PlansPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/plans/:planId" element={<PlanLayout />}>
            <Route path="shifts" element={<ShiftsPage />} />
            <Route path="headcount" element={<HeadcountPage />} />
            <Route path="leaves" element={<LeavesPage />} />
          </Route>
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <AppShell />
      </AppStateProvider>
    </AuthProvider>
  )
}
