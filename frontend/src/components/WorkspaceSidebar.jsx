export default function WorkspaceSidebar({
  navItems,
  activeSection,
  onSelectSection,
  onLogout,
  renderIcon,
}) {
  return (
    <aside className="workspace-sidebar">
      <div className="brand-block">
        <div className="brand-mark">Q</div>
        <div>
          <p className="brand-name">Qwyse</p>
          <p className="brand-subtitle">Career intelligence</p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace sections">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === activeSection ? "sidebar-link active" : "sidebar-link"}
            onClick={() => onSelectSection(item.id)}
          >
            {renderIcon(item.icon)}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="workspace-sidebar-footer">
        <button type="button" className="sidebar-logout" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}