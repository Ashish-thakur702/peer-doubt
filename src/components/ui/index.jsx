'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export function Card({ as: Component = 'section', className = '', children, ...props }) {
    return <Component className={`ui-card ${className}`.trim()} {...props}>{children}</Component>;
}

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', children, ...props }) {
    const variantClass = variant === 'quiet' ? 'btn-quiet' : variant === 'default' ? 'btn' : 'btn-primary';
    return <button type={type} className={`${variantClass} ui-button ui-button-${size} ${className}`.trim()} {...props}>{children}</button>;
}

export function Badge({ tone = 'neutral', children, className = '', ...props }) {
    return <span className={`ui-badge ui-badge-${tone} ${className}`.trim()} {...props}>{children}</span>;
}

export function Modal({ open, onClose, title, description, children, className = '' }) {
    const titleId = useId();
    const descriptionId = useId();
    const dialogRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const previousOverflow = document.body.style.overflow;
        const previouslyFocused = document.activeElement;
        document.body.style.overflow = 'hidden';
        const focusable = () => [...(dialogRef.current?.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])];
        window.requestAnimationFrame(() => focusable()[0]?.focus());
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
            if (event.key === 'Tab') {
                const items = focusable();
                if (!items.length) { event.preventDefault(); return; }
                if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
                else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
            if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
        };
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;
    return createPortal(
        <div className="ui-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
            <section ref={dialogRef} className={`ui-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
                <header className="ui-modal-header"><div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div><button type="button" className="ui-modal-close" onClick={onClose} aria-label="Close dialog">×</button></header>
                <div className="ui-modal-content">{children}</div>
            </section>
        </div>,
        document.body,
    );
}

export function DataTable({ columns, rows, getRowKey, empty, caption, className = '' }) {
    return <div className={`ui-table-wrap ${className}`.trim()}><table className="ui-table">
        {caption && <caption>{caption}</caption>}
        <thead><tr>{columns.map((column) => <th scope="col" key={column.key} className={column.className || ''}>{column.label}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={getRowKey ? getRowKey(row, index) : index}>{columns.map((column) => <td key={column.key} className={column.cellClassName || ''}>{column.render ? column.render(row, index) : row[column.key]}</td>)}</tr>)}</tbody>
    </table>{rows.length === 0 && <div className="ui-table-empty">{empty || 'Nothing to show yet.'}</div>}</div>;
}

export function Skeleton({ className = '', lines = 0, label = 'Loading content' }) {
    return <div className={`ui-skeleton ${className}`.trim()} aria-label={label} role="status">
        {Array.from({ length: lines }, (_, index) => <span key={index} className="ui-skeleton-line" />)}
    </div>;
}

export function EmptyState({ icon = '✳', title, description, action, className = '' }) {
    return <section className={`ui-empty-state ${className}`.trim()}>
        <span className="ui-empty-icon" aria-hidden="true">{icon}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {action && <div className="ui-empty-action">{action}</div>}
    </section>;
}
