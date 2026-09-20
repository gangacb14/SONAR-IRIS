import React from 'react';
import { 
  LayoutDashboard,
  Waves, 
  Target, 
  Map, 
  ListOrdered, 
  FileText, 
  Sliders, 
  Radio, 
  HelpCircle,
  Eye
} from 'lucide-react';

export type ActiveNavView = 'OVERVIEW' | 'SONAR_SCAN' | 'DETECTIONS' | 'MAP' | 'MISSION' | 'REPORT';

interface NavigationRailProps {
  activeView: ActiveNavView;
  onSelectView: (view: ActiveNavView) => void;
  pendingReviewsCount: number;
  totalDetectionsCount: number;
  frequencyKhz: number;
  onToggleFrequency: () => void;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeView,
  onSelectView,
  pendingReviewsCount,
  totalDetectionsCount,
  frequencyKhz,
  onToggleFrequency,
  isRightPanelOpen,
  onToggleRightPanel,
}) => {
  const navItems: Array<{
    id: ActiveNavView;
    label: string;
    icon: React.ElementType;
    badge?: number;
    badgeVariant?: 'amber' | 'cyan';
  }> = [
    {
      id: 'OVERVIEW',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'SONAR_SCAN',
      label: 'Sonar Scan',
      icon: Waves,
    },
    {
      id: 'DETECTIONS',
      label: 'Detections',
      icon: Target,
      badge: pendingReviewsCount > 0 ? pendingReviewsCount : totalDetectionsCount,
      badgeVariant: pendingReviewsCount > 0 ? 'amber' : 'cyan',
    },
    {
      id: 'MAP',
      label: 'Map',
      icon: Map,
    },
    {
      id: 'MISSION',
      label: 'Mission',
      icon: ListOrdered,
    },
    {
      id: 'REPORT',
      label: 'Report',
      icon: FileText,
    },
  ];

  return (
    <aside 
      id="navigation-rail" 
      className="w-16 md:w-56 bg-[#090d14] border-r border-[#1e293b] flex flex-col justify-between select-none z-20 flex-shrink-0"
    >
      {/* Upper Navigation section */}
      <div className="flex flex-col py-3">
        <div className="hidden md:block px-3.5 mb-2.5">
          <span className="text-[10px] font-mono-tech tracking-wider uppercase text-slate-400">
            OPERATIONAL VIEWS
          </span>
        </div>

        <nav className="flex flex-col gap-1 px-1.5 md:px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id.toLowerCase()}`}
                onClick={() => onSelectView(item.id)}
                className={`flex items-center gap-3 px-2.5 py-2.5 rounded transition-all text-left group relative ${
                  isActive
                    ? 'bg-[#131b29] text-sky-400 border border-[#2c3a50]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e141f] border border-transparent'
                }`}
                title={item.label}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                
                <span className="hidden md:inline text-xs font-medium tracking-wide flex-1 truncate">
                  {item.label}
                </span>

                {/* Badge indicator */}
                {item.badge !== undefined && (
                  <span
                    className={`hidden md:inline-block text-[10px] font-mono-tech font-semibold px-1.5 py-0.2 rounded border ${
                      item.badgeVariant === 'amber'
                        ? 'bg-amber-950/80 border-amber-700/60 text-amber-300'
                        : 'bg-[#131b29] border-[#2c3a50] text-sky-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Active indicator bar on mobile / compact */}
                {isActive && (
                  <div className="md:hidden absolute right-0 top-1 bottom-1 w-0.5 bg-sky-400 rounded-l" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Lower Hardware & Sonar Controls */}
      <div className="p-2 border-t border-[#1e293b] flex flex-col gap-2">
        {/* Frequency Selector */}
        <div className="hidden md:flex flex-col gap-1 px-1.5">
          <div className="flex justify-between items-center text-[10px] font-mono-tech text-slate-400 uppercase">
            <span>TRANSDUCER FREQ</span>
            <Radio className="w-3 h-3 text-sky-400" />
          </div>
          <button
            id="btn-toggle-frequency"
            onClick={onToggleFrequency}
            className="w-full text-left px-2 py-1.5 bg-[#0e141f] border border-[#1e293b] hover:border-[#2c3a50] rounded text-[11px] font-mono-tech text-slate-200 flex items-center justify-between transition-colors"
          >
            <span>{frequencyKhz} kHz CHIRP</span>
            <span className="text-[10px] text-sky-400">
              {frequencyKhz === 410 ? 'HIGH-RES' : 'LONG-RANGE'}
            </span>
          </button>
        </div>

        {/* Toggle Right Inspector Panel */}
        <button
          id="btn-toggle-inspector-panel"
          onClick={onToggleRightPanel}
          className={`flex items-center justify-center md:justify-between px-2 py-2 rounded text-xs transition-colors border ${
            isRightPanelOpen
              ? 'bg-[#131b29] text-sky-300 border-[#2c3a50]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e141f] border-transparent'
          }`}
          title={isRightPanelOpen ? 'Hide Target Details Inspector' : 'Show Target Details Inspector'}
        >
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px] font-medium">Inspector Panel</span>
          </div>
          <span className="hidden md:inline text-[9px] font-mono-tech uppercase text-slate-400">
            {isRightPanelOpen ? 'OPEN' : 'COLLAPSED'}
          </span>
        </button>

        {/* System Reference Bar */}
        <div className="hidden md:flex flex-col px-1.5 pt-1 text-[9px] font-mono-tech text-slate-400">
          <div className="flex justify-between">
            <span>SWATH: 150m</span>
            <span>PING #42,180</span>
          </div>
          <div className="text-slate-400 mt-0.5">
            Subsea Vision • Real-Time AI
          </div>
        </div>
      </div>
    </aside>
  );
};
