import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavEntry, NavGroup, NavItem } from '@/types';

const isGroup = (entry: NavEntry): entry is NavGroup => 'items' in entry;

function NavLink({ item }: { item: NavItem }) {
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={isCurrentUrl(item.href)}
                tooltip={{ children: item.title }}
            >
                <Link href={item.href} prefetch>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

function NavGroupMenu({ group }: { group: NavGroup }) {
    const { isCurrentUrl } = useCurrentUrl();
    const { state, setOpen } = useSidebar();
    const [expanded, setExpanded] = useState(true);
    const collapsed = state === 'collapsed';
    const containsCurrent = group.items.some((item) => isCurrentUrl(item.href));

    const toggle = (next: boolean) => {
        // Sub-pages are hidden in the icon-only sidebar: expand the sidebar
        // and keep this menu open instead of folding it.
        if (collapsed) {
            setOpen(true);
            setExpanded(true);
        } else {
            setExpanded(next);
        }
    };

    return (
        <Collapsible
            asChild
            open={expanded}
            onOpenChange={toggle}
            className="group/collapsible"
        >
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        tooltip={{ children: group.title }}
                        isActive={collapsed && containsCurrent}
                    >
                        {group.icon && <group.icon />}
                        <span>{group.title}</span>
                        <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {group.items.map((item) => (
                            <SidebarMenuSubItem key={item.title}>
                                <SidebarMenuSubButton
                                    asChild
                                    isActive={isCurrentUrl(item.href)}
                                >
                                    <Link href={item.href} prefetch>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
}

export function NavMain({ items }: { items: NavEntry[] }) {
    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((entry) =>
                    isGroup(entry) ? (
                        <NavGroupMenu key={entry.title} group={entry} />
                    ) : (
                        <NavLink key={entry.title} item={entry} />
                    ),
                )}
            </SidebarMenu>
        </SidebarGroup>
    );
}
