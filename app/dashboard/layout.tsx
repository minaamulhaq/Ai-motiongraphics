import {DashboardShell} from '@/components/dashboard';
import {Suspense} from 'react';
import './dashboard.css';
import './video-engine.css';
export default function Layout({children}:{children:React.ReactNode}){return <Suspense fallback={<div className="dashboard-loading" role="status">Loading your studio...</div>}><DashboardShell>{children}</DashboardShell></Suspense>}
