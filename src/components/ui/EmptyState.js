export function EmptyState({ icon, title, description, action }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            textAlign: 'center',
        }}>
            <div style={{ color: 'var(--text-tertiary)', marginBottom: '16px', opacity: 0.6 }}>
                {icon}
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
                {title}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px 0', maxWidth: '300px', lineHeight: 1.5 }}>
                {description}
            </p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="btn-primary"
                    style={{ background: 'var(--accent-color)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
