import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import GeneratePage from './pages/GeneratePage';
import HistoryPage from './pages/HistoryPage';
import HistoryDetailPage from './pages/HistoryDetailPage';
import SettingsPage from './pages/SettingsPage';
import LearningHubPage from './pages/LearningHubPage';
import PlansPage from './pages/PlansPage';
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: 'Landing',
    path: '/',
    element: <LandingPage />,
    public: true,
  },
  {
    name: 'Login',
    path: '/login',
    element: <LoginPage />,
    public: true,
  },
  {
    name: 'Sign Up',
    path: '/signup',
    element: <SignUpPage />,
    public: true,
  },
  {
    name: 'Dashboard',
    path: '/dashboard',
    element: <DashboardPage />,
  },
  {
    name: 'Generate Cover Letter',
    path: '/generate',
    element: <GeneratePage />,
  },
  {
    name: 'History',
    path: '/history',
    element: <HistoryPage />,
  },
  {
    name: 'History Detail',
    path: '/history/:id',
    element: <HistoryDetailPage />,
  },
  {
    name: 'Learning Hub',
    path: '/learning-hub',
    element: <LearningHubPage />,
  },
  {
    name: 'Plans',
    path: '/plans',
    element: <PlansPage />,
  },
  {
    name: 'Settings',
    path: '/settings',
    element: <SettingsPage />,
  },
];

export default routes;
