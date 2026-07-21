import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, FileText, History, Settings, LogOut, BookOpen, FilePenLine } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import GenerationIndicator from '@/components/common/GenerationIndicator';
import ChatWidget from '@/components/common/ChatWidget';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', path: '/dashboard', icon: Home },
  { name: 'Generate Cover Letter', path: '/generate', icon: FileText },
  { name: 'CV Builder', path: '/cv-builder', icon: FilePenLine },
  { name: 'History', path: '/history', icon: History },
  { name: 'Learning Hub', path: '/learning-hub', icon: BookOpen },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/');
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-secondary hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="font-medium">{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r border-border bg-card shrink-0">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <span className="text-accent-foreground font-bold text-lg">A</span>
              </div>
              <span className="text-2xl font-bold">Aur.a</span>
            </Link>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <NavLinks />
          </nav>

          <div className="p-4 border-t border-border">
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleSignOut}
            >
              <LogOut className="w-5 h-5" />
              <span>Sign out</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-accent-foreground font-bold text-lg">A</span>
            </div>
            <span className="text-xl font-bold">Aur.a</span>
          </Link>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-border">
                  <Link
                    to="/"
                    className="flex items-center gap-2"
                    onClick={() => setMobileOpen(false)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                      <span className="text-accent-foreground font-bold text-lg">A</span>
                    </div>
                    <span className="text-2xl font-bold">Aur.a</span>
                  </Link>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                  <NavLinks onNavigate={() => setMobileOpen(false)} />
                </nav>

                <div className="p-4 border-t border-border">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign out</span>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0 lg:ml-0 pt-16 lg:pt-0 overflow-x-hidden">
        <div className="container mx-auto p-6 max-w-7xl">{children}</div>
      </main>

      {/* Persistent generation status indicator (shown across all pages) */}
      <GenerationIndicator />

      {/* Global AI chat widget — visible on all authenticated pages */}
      <ChatWidget />
    </div>
  );
}
