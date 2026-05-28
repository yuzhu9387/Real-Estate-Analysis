import type { ReactNode } from 'react'
import { requireUser } from '@/lib/server/get-current-user'
import { PermissionsProvider } from '@/lib/hooks/use-permissions'
import { Sidebar } from '@/components/layout/sidebar'
import { TopAppBar } from '@/components/layout/top-app-bar'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  return (
    <>
      <Sidebar user={user} />
      <TopAppBar user={user} />
      <PermissionsProvider user={user}>
        <main className="ml-[240px] pt-16 min-h-screen p-lg bg-surface-container-low/30">
          {children}
        </main>
      </PermissionsProvider>
    </>
  )
}
