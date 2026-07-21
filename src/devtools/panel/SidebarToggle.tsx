import React from 'react';

export interface SidebarToggleProps {
  children: React.ReactNode;
}

export function SidebarToggle({ children }: SidebarToggleProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    document.body.classList.toggle('menu-open', isOpen);
    return () => {
      document.body.classList.remove('menu-open');
    };
  }, [isOpen]);

  const toggleDrawer = () => {
    setIsOpen((current) => !current);
  };

  const closeDrawer = () => {
    setIsOpen(false);
  };

  const handleDrawerClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('button')) closeDrawer();
  };

  return (
    <div className="qa-menu-bar">
      <button
        id="menuToggleBtn"
        className={`menu-toggle${isOpen ? ' active' : ''}`}
        aria-expanded={isOpen}
        aria-controls="workspaceNav"
        type="button"
        onClick={toggleDrawer}
      >
        <svg className="menu-toggle-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14" /></svg>
        <span className="menu-toggle-label">Menu</span>
      </button>
      <nav
        id="workspaceNav"
        className={`qa-menu${isOpen ? ' open' : ''}`}
        role="menu"
        aria-label="QA tool sections"
        onClick={handleDrawerClick}
      >
        <div className="qa-menu-head">
          <div>
            <strong>TestPilot Menu</strong>
            <small>Open manual QA panels or run focused tools.</small>
          </div>
          <button id="menuCloseBtn" className="qa-menu-close" type="button" aria-label="Close menu" onClick={closeDrawer}>×</button>
        </div>
        {children}
      </nav>
    </div>
  );
}