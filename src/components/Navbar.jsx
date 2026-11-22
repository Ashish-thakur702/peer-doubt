'use client';

import { fetchWithTimeout } from '@/lib/client-fetch';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/components/Providers';
import { getNavigationLinks } from '@/lib/navigation.mjs';
import { roleLabel, getPrimaryRole } from '@/lib/auth/roles.mjs';

const ICONS = {
    inbox: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><path d="M4 14h4l1.5 2h5L16 14h4"/></>,
    plus: <><circle cx="12" cy="12" r="8.25"/><path d="M12 8v8M8 12h8"/></>,
    users: <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3"/><path d="M16 5a3 3 0 0 1 0 6M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35"/></>,
    book: <><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5z"/><path d="M5 4.5v17M9 6h7M9 10h7"/></>,
    bookmark: <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.5L6 21z"/>,
    bell: <><path d="M18 9.5a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18c0-1.5-3-1.5-3-8.5z"/><path d="M10 21h4"/></>,
    sparkles: <><path d="m12 3 1.1 3.9L17 8l-3.9 1.1L12 13l-1.1-3.9L7 8l3.9-1.1z"/><path d="m19 14 .6 2.4L22 17l-2.4.6L19 20l-.6-2.4L16 17l2.4-.6z"/></>,
    shield: <><path d="M12 3 19 6v5c0 4.7-2.9 8-7 10-4.1-2-7-5.3-7-10V6z"/><path d="m9 12 2 2 4-4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.1.9-1.2 2.1-1.4-.5a7.8 7.8 0 0 1-1.5.9l-.3 1.5h-2.4l-.3-1.5a7.8 7.8 0 0 1-1.5-.9l-1.4.5-1.2-2.1 1.1-.9a8 8 0 0 1 0-1.8l-1.1-.9 1.2-2.1 1.4.5a7.8 7.8 0 0 1 1.5-.9l.3-1.5h2.4l.3 1.5a7.8 7.8 0 0 1 1.5.9l1.4-.5 1.2 2.1-1.1.9a8 8 0 0 1 0 1.7z" transform="translate(-1 -1)"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.2 4.2"/></>,
    sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.4 1.4M17.67 17.67l1.4 1.4M2 12h2M20 12h2M4.93 19.07l1.4-1.4M17.67 6.33l1.4-1.4"/></>,
    moon: <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2z"/>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    collapse: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m5-10 2 2-2 2"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
};

function Icon({ name, size = 18 }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name] || ICONS.inbox}</svg>;
}

function iconFor(href) {
    return ({
        '/doubts/mine': 'inbox', '/doubts/new': 'plus', '/helper': 'users',
        '/helper/profile': 'sparkles', '/knowledge': 'book', '/knowledge/saved': 'bookmark',
        '/moderation': 'shield', '/admin/users': 'settings',
    })[href] || 'inbox';
}

function Brand({ compact = false }) {
    return <Link href="/doubts/mine" className="app-brand" aria-label="unStuck home">
        <span className="brand-mark" aria-hidden="true">uS</span>
        <span className="app-brand-word"><span>un</span>Stuck</span>
        {!compact && <span className="app-brand-pulse" aria-hidden="true"/>}
    </Link>;
}

export default function Navbar() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [unread, setUnread] = useState(0);
    const [freshRoleState, setFreshRoleState] = useState(null);
    const [collapsed, setCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeCommand, setActiveCommand] = useState(0);
    const searchRef = useRef(null);
    const commandDialogRef = useRef(null);
    const userMenuRef = useRef(null);
    const roles = session?.user?.id
        && freshRoleState?.userId === session.user.id
        && Array.isArray(freshRoleState.roles)
        ? freshRoleState.roles
        : (session?.user?.roles || (session?.user?.role ? [session.user.role] : []));
    const currentRole = session ? getPrimaryRole(roles) : null;
    const links = session ? getNavigationLinks(roles) : [];
    const navLinks = links.filter((item) => item.href !== '/notifications');
    const roleShortcut = roles.includes('helper') ? '/helper'
        : roles.some((role) => ['cr', 'faculty', 'admin'].includes(role)) ? '/moderation'
            : '/knowledge';
    const mobilePrimary = ['/doubts/mine', '/doubts/new', roleShortcut, '/knowledge']
        .filter((href, index, list) => list.indexOf(href) === index)
        .map((href) => navLinks.find((item) => item.href === href))
        .filter(Boolean)
        .slice(0, 3);
    const mobileMore = [...navLinks.filter((item) => !mobilePrimary.some((primary) => primary.href === item.href)), { href: '/notifications', label: 'Notifications' }];
    const activePage = [...navLinks].sort((a, b) => b.href.length - a.href.length).find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    const initials = (session?.user?.name || session?.user?.email || 'U').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    const shortName = session?.user?.name?.trim().split(/\s+/)[0] || 'there';

    const commands = useMemo(() => {
        const base = navLinks.map((item) => ({ ...item, kind: 'page' }));
        if (session) base.push({ href: '/notifications', label: 'Notifications', kind: 'page' });
        const needle = query.trim().toLowerCase();
        const matched = needle ? base.filter((item) => item.label.toLowerCase().includes(needle)) : base;
        if (needle && !matched.some((item) => item.href === '/knowledge')) {
            matched.push({ href: `/knowledge?q=${encodeURIComponent(query.trim())}`, label: `Search knowledge for “${query.trim()}”`, kind: 'search' });
        } else if (needle) {
            matched.push({ href: `/knowledge?q=${encodeURIComponent(query.trim())}`, label: `Search knowledge for “${query.trim()}”`, kind: 'search' });
        }
        return matched.slice(0, 8);
    }, [navLinks, query, session]);

    useEffect(() => {
        if (!session) return undefined;
        let active = true;
        async function refresh() {
            try {
                const response = await fetchWithTimeout('/api/notifications?limit=1');
                if (response.ok) {
                    const data = await response.json();
                    if (active) setUnread(data.unread || 0);
                }
            } catch { /* Notifications remain available from the app navigation. */ }
        }
        refresh();
        const timer = setInterval(refresh, 60000);
        return () => { active = false; clearInterval(timer); };
    }, [session]);

    useEffect(() => {
        if (!session?.user?.id) return undefined;
        let active = true;
        fetchWithTimeout('/api/auth/me').then(async (response) => {
            const data = await response.json();
            if (active) setFreshRoleState({
                userId: session.user.id,
                roles: response.ok ? data.roles || [] : session.user.roles || (session.user.role ? [session.user.role] : []),
            });
        }).catch(() => {
            if (active) setFreshRoleState({ userId: session.user.id, roles: session.user.roles || (session.user.role ? [session.user.role] : []) });
        });
        return () => { active = false; };
    }, [session?.user?.id, session?.user?.role, pathname]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault(); setPaletteOpen(true); setUserMenuOpen(false);
            }
            if (event.key === 'Escape') { setPaletteOpen(false); setUserMenuOpen(false); }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        if (paletteOpen) {
            setQuery(''); setActiveCommand(0);
            window.requestAnimationFrame(() => searchRef.current?.focus());
        }
    }, [paletteOpen]);

    useEffect(() => {
        setUserMenuOpen(false); setPaletteOpen(false); setMobileMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!userMenuOpen) return undefined;
        const closeOnOutside = (event) => { if (!userMenuRef.current?.contains(event.target)) setUserMenuOpen(false); };
        document.addEventListener('pointerdown', closeOnOutside);
        return () => document.removeEventListener('pointerdown', closeOnOutside);
    }, [userMenuOpen]);

    useEffect(() => {
        if (!mobileMenuOpen) return undefined;
        const closeOnOutside = (event) => {
            if (!event.target.closest('.mobile-more-menu, .mobile-more-trigger')) setMobileMenuOpen(false);
        };
        document.addEventListener('pointerdown', closeOnOutside);
        return () => document.removeEventListener('pointerdown', closeOnOutside);
    }, [mobileMenuOpen]);

    function openCommand(item) {
        setPaletteOpen(false);
        router.push(item.href);
    }

    function onPaletteKeyDown(event) {
        if (event.key === 'ArrowDown') { event.preventDefault(); setActiveCommand((value) => Math.min(value + 1, commands.length - 1)); }
        if (event.key === 'ArrowUp') { event.preventDefault(); setActiveCommand((value) => Math.max(value - 1, 0)); }
        if (event.key === 'Enter' && commands[activeCommand]) { event.preventDefault(); openCommand(commands[activeCommand]); }
        if (event.key === 'Tab') {
            const focusable = [...(commandDialogRef.current?.querySelectorAll('input:not(:disabled), button:not(:disabled)') || [])];
            if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
            else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
        }
    }

    if (!session) {
        return <header className="app-navbar app-navbar-public"><nav className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[17px] font-bold tracking-tight"><span className="brand-mark flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold">uS</span><span><span className="brand-wordmark-un">un</span><span className="brand-wordmark-stuck">Stuck</span></span></Link>
            <div className="ml-auto flex items-center gap-2 text-sm sm:gap-3"><button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}><Icon name={theme === 'dark' ? 'sun' : 'moon'}/><span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span></button><Link href="/login" className="rounded-lg px-3 py-2 font-medium hover:bg-paper">Log in</Link><Link href="/register" className="btn-primary min-h-9 px-3 text-xs sm:text-sm">Create account</Link></div>
        </nav></header>;
    }

    return <>
        <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Main navigation">
            <div className="sidebar-brand-row"><Brand/><button type="button" className="sidebar-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Icon name="collapse" size={17}/></button></div>
            <div className="sidebar-label">LEARNING SPACE</div>
            <nav className="sidebar-links">
                {navLinks.map((item) => {
                    const active = activePage?.href === item.href;
                    return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} title={collapsed ? item.label : undefined} className={`sidebar-link ${active ? 'is-active' : ''}`}>
                        <span className="sidebar-link-icon"><Icon name={iconFor(item.href)}/></span><span className="sidebar-link-label">{item.label}</span>{active && <span className="sidebar-active-dot" aria-hidden="true"/>}
                    </Link>;
                })}
            </nav>
            <div className="sidebar-bottom">
                <div className="sidebar-note"><span className="sidebar-note-icon"><Icon name="sparkles" size={17}/></span><span><strong>Keep learning together</strong><small>Good questions make good notes.</small></span></div>
                <div className="sidebar-user">
                    <span className="user-avatar" aria-hidden="true">{initials}</span><span className="sidebar-user-copy"><strong>{session.user.name || 'Student'}</strong><small>{roleLabel(currentRole)}</small></span>
                </div>
            </div>
        </aside>

        <header className="app-topbar">
            <div className="topbar-context"><span className="topbar-context-label">{activePage?.label || 'Workspace'}</span><span className="topbar-context-separator">/</span><span className="topbar-context-welcome">Good to see you, {shortName}</span></div>
            <div className="topbar-actions">
                <button type="button" className="topbar-search" onClick={() => setPaletteOpen(true)} aria-label="Search or jump to a page"><Icon name="search"/><span>Search anything</span><kbd><span>⌘</span>K</kbd></button>
                <Link href="/notifications" className="topbar-icon-button notification-action" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} title="Notifications"><Icon name="bell"/>{unread > 0 && <span className="notification-dot">{unread > 99 ? '99+' : unread}</span>}</Link>
                <button type="button" className="topbar-icon-button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Change appearance"><Icon name={theme === 'dark' ? 'sun' : 'moon'}/></button>
                <div className="topbar-profile" ref={userMenuRef}>
                    <button type="button" className="topbar-profile-button" onClick={() => setUserMenuOpen((value) => !value)} aria-expanded={userMenuOpen} aria-haspopup="menu"><span className="user-avatar">{initials}</span><span className="topbar-profile-name">{session.user.name || 'Account'}</span><Icon name="chevron" size={14}/></button>
                    {userMenuOpen && <div className="user-menu" role="menu"><div className="user-menu-heading"><span className="user-avatar">{initials}</span><span><strong>{session.user.name || 'Account'}</strong><small>{session.user.email || roleLabel(currentRole)}</small></span></div><div className="user-menu-role">{roleLabel(currentRole)}</div><button type="button" role="menuitem" className="user-menu-item" onClick={() => signOut({ callbackUrl: '/login' })}><span>Log out</span><Icon name="logout" size={15}/></button></div>}
                </div>
            </div>
        </header>

        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
            {mobilePrimary.map((item) => {
                const active = activePage?.href === item.href;
                return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`mobile-bottom-link ${active ? 'is-active' : ''}`}><Icon name={iconFor(item.href)} size={19}/><span>{item.label.replace('Knowledge library', 'Library').replace('My doubts', 'My doubts').replace('Help classmates', 'Help').replace('Ask a doubt', 'Ask')}</span></Link>;
            })}
            <button type="button" className={`mobile-bottom-link mobile-more-trigger ${mobileMenuOpen ? 'is-active' : ''}`} onClick={() => setMobileMenuOpen((value) => !value)} aria-expanded={mobileMenuOpen} aria-haspopup="menu"><Icon name="settings" size={19}/><span>More</span></button>
        </nav>
        {mobileMenuOpen && <div className="mobile-more-menu" role="menu" aria-label="More navigation">
            <p className="mobile-more-heading">YOUR WORKSPACE</p>
            {mobileMore.map((item) => <Link key={item.href} role="menuitem" href={item.href} className="mobile-more-link"><Icon name={item.href === '/notifications' ? 'bell' : iconFor(item.href)} size={17}/><span>{item.label}</span>{item.href === '/notifications' && unread > 0 && <span className="mobile-more-count">{unread > 99 ? '99+' : unread}</span>}</Link>)}
        </div>}

        {paletteOpen && <div className="command-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}>
            <section ref={commandDialogRef} className="command-dialog" role="dialog" aria-modal="true" aria-label="Search and navigate" onKeyDown={onPaletteKeyDown}>
                <div className="command-input-row"><Icon name="search"/><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveCommand(0); }} placeholder="Search knowledge or jump to a page..." aria-label="Search knowledge or pages"/><kbd>ESC</kbd></div>
                <p className="command-label">{query ? 'SUGGESTED DESTINATIONS' : 'QUICK NAVIGATION'}</p>
                <div className="command-results" role="listbox">{commands.length ? commands.map((item, index) => <button type="button" role="option" aria-selected={activeCommand === index} key={`${item.href}-${item.label}`} className={`command-result ${activeCommand === index ? 'is-highlighted' : ''}`} onMouseEnter={() => setActiveCommand(index)} onClick={() => openCommand(item)}><span className="command-result-icon"><Icon name={item.kind === 'search' ? 'search' : iconFor(item.href)} size={17}/></span><span>{item.label}</span><span className="command-result-enter">↵</span></button>) : <p className="command-empty">No pages match that search.</p>}</div>
                <footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span><span><kbd>↵</kbd> to open</span><span><kbd>⌘</kbd><kbd>K</kbd> to toggle</span></footer>
            </section>
        </div>}
    </>;
}
