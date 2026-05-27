import type { ReactNode } from 'react'
import { requireUser } from '@/lib/server/get-current-user'
import { PermissionsProvider } from '@/lib/hooks/use-permissions'
import { Sidebar } from '@/components/layout/sidebar'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  return (
    <div className="flex">
      <Sidebar user={user} />
      <PermissionsProvider user={user}>
        <main className="flex-1 p-6">{children}</main>
      </PermissionsProvider>
    </div>
  )
}
