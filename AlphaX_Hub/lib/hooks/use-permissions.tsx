'use client'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { can, type Action } from '@/lib/permissions'
import type { User } from '@/db/schema'

const PermissionsContext = createContext<User | null>(null)

export function PermissionsProvider({ user, children }: { user: User | null; children: ReactNode }) {
  return <PermissionsContext.Provider value={user}>{children}</PermissionsContext.Provider>
}

export function usePermissions() {
  const user = useContext(PermissionsContext)
  return useMemo(() => ({
    user,
    can: (action: Action) => (user ? can(user, action) : false),
  }), [user])
}
