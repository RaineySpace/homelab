'use client'

import Link from 'next/link'
import {
  BotIcon,
  ClipboardCheckIcon,
  CookingPotIcon,
  LayoutDashboardIcon,
  SaladIcon,
  UserRoundCogIcon,
  UsersRoundIcon,
} from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@family-os/ui/components/sidebar'

const householdLinks = [
  { title: '总览', href: '/', icon: LayoutDashboardIcon },
  { title: '人物', href: '/people', icon: UsersRoundIcon },
  { title: '菜谱', href: '/recipes', icon: SaladIcon },
  { title: '配餐', href: '/meals', icon: CookingPotIcon },
  { title: '任务', href: '/tasks', icon: ClipboardCheckIcon },
  { title: '助手', href: '/agent', icon: BotIcon },
]

export function NavMain({ pathname, isOwner }: { pathname: string; isOwner: boolean }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const links = isOwner
    ? [...householdLinks, { title: '账号', href: '/accounts', icon: UserRoundCogIcon }]
    : householdLinks

  return (
    <SidebarGroup>
      <SidebarGroupLabel>家庭空间</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {links.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={pathname === item.href}
                render={<Link href={item.href} onClick={() => isMobile && setOpenMobile(false)} />}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
