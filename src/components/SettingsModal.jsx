export default function SettingsModal({ isOpen, onClose, userPin, onUnpair, onLogout, isAdmin, onOpenAdmin, theme, cycleTheme }) {
    if (!isOpen) return null;

    let themeNameDisplay = "MODERN UI";
    if (theme === 'retro-green') themeNameDisplay = "RETRO GREEN";
    if (theme === 'retro-blue') themeNameDisplay = "RETRO BLUE";
    if (theme === 'retro-amber') themeNameDisplay = "RETRO AMBER";

    return (
        <div className="overlay" style={{ zIndex: 10000 }}>
            <div className="modal-content small">
                <h2 style={{ marginTop: 0, color: 'var(--text-main)' }}>Settings</h2>
                
                <div style={{ flexGrow: 1 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5 }}>
                        Manage your connection and account.
                    </p>
                    
                    <div style={{ background: '#000', border: '1px solid var(--border-panel)', borderRadius: '8px', padding: '12px', marginBottom: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold' }}>
                            Current Pairing ID
                        </div>
                        <div style={{ fontFamily: '"Roboto Mono", monospace', fontSize: '24px', color: 'var(--accent-blue)', fontWeight: 800, letterSpacing: '2px' }}>
                            {userPin || "------"}
                        </div>
                    </div>

                    {/* NEW: Left/Right Theme Picker */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold', textAlign: 'center' }}>
                            Interface Theme
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-panel)', border: '1px solid var(--text-muted)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-main)' }}>
                            <button onClick={() => cycleTheme('prev')} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', padding: '0 10px' }}>&lt;</button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', letterSpacing: '1px' }}>
                                <span className="retro-hide">🖥️ </span> {themeNameDisplay}
                            </div>
                            <button onClick={() => cycleTheme('next')} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', padding: '0 10px' }}>&gt;</button>
                        </div>
                    </div>

                    {isAdmin && (
                        <button onClick={onOpenAdmin} className="btn-action btn-primary" style={{marginBottom: '16px'}}>
                            <span className="retro-hide">👑 </span>OPEN ADMIN DASHBOARD
                        </button>
                    )}

                    <button onClick={onUnpair} className="unpair-btn" style={{marginTop: '0'}}>
                        UNPAIR SIMULATOR
                    </button>
                    
                    <button onClick={onLogout} className="btn-action btn-outline" style={{marginTop: '12px'}}>
                        LOG OUT
                    </button>
                </div>

                <button className="cancel-btn" style={{ marginTop: '24px' }} onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    );
}