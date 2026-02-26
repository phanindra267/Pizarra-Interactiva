import React from 'react';

export default function ExportOverlay({ progress, total, status }) {
    const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;

    return (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
            <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '16px' }}>🚀 Exporting Session</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    {status || 'Rendering your collaborative session into a high-quality video...'}
                </p>

                <div className="progress-container" style={{
                    width: '100%',
                    height: '8px',
                    background: 'var(--bg-glass)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '12px'
                }}>
                    <div className="progress-bar" style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: 'var(--accent-gradient)',
                        transition: 'width 0.3s ease'
                    }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>{percentage}% Complete</span>
                    <span>{progress} / {total} frames</span>
                </div>

                <div style={{ marginTop: '24px', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Please do not close this tab while the export is in progress.
                </div>
            </div>
        </div>
    );
}
