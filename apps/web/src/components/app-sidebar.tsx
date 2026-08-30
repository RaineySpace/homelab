'use client'

import * as React from 'react'
import Link from 'next/link'
import { HouseHeartIcon } from 'lucide-react'
import { NavMain } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import type { Session } from '@/components/AppShell'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@family-os/ui/components/sidebar'

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  session: Session | null
  pathname: string
  onLogout: () => Promise<void>
}

export function AppSidebar({ session, pathname, onLogout, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <HouseHeartIcon className="size-4" />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">Family OS</span>
                <span className="truncate text-xs text-sidebar-foreground/60">家庭操作系统</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain pathname={pathname} isOwner={session?.role === 'owner'} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser session={session} pathname={pathname} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
