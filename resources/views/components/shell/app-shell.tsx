import { SkipLink } from '@/components/shell/skip-link';
import { SidebarProvider } from '@/components/ui/sidebar';
import { WorkspaceRuntime } from '@/components/workspace/workspace-runtime';
import { useState } from 'react';

interface AppShellProps {
    children: React.ReactNode;
    variant?: 'header' | 'sidebar';
}

export function AppShell({ children, variant = 'header' }: AppShellProps) {
    const [isOpen, setIsOpen] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('sidebar') !== 'false' : true));

    const handleSidebarChange = (open: boolean) => {
        setIsOpen(open);

        if (typeof window !== 'undefined') {
            localStorage.setItem('sidebar', String(open));
        }
    };

    if (variant === 'header') {
        return (
            <div className="flex min-h-screen w-full flex-col">
                <SkipLink />
                <WorkspaceRuntime>{children}</WorkspaceRuntime>
            </div>
        );
    }

    return (
        <SidebarProvider className="workspace-shell" defaultOpen={isOpen} open={isOpen} onOpenChange={handleSidebarChange}>
            <SkipLink />
            <WorkspaceRuntime>{children}</WorkspaceRuntime>
        </SidebarProvider>
    );
}
