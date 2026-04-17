import './skeleton.css';

export function SkeletonCard() {
    return (
        <div className="skeleton-card">
            <div className="skeleton-block" style={{ width: '60%', height: '12px', marginBottom: '16px' }} />
            <div className="skeleton-block" style={{ width: '80%', height: '32px', marginBottom: '8px' }} />
            <div className="skeleton-block" style={{ width: '40%', height: '12px' }} />
        </div>
    );
}

export function SkeletonRow() {
    return (
        <div style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
            <div className="skeleton-block" style={{ width: '80px', height: '14px' }} />
            <div className="skeleton-block" style={{ width: '120px', height: '14px' }} />
            <div className="skeleton-block" style={{ width: '160px', height: '14px' }} />
            <div className="skeleton-block" style={{ marginLeft: 'auto', width: '80px', height: '14px' }} />
        </div>
    );
}
