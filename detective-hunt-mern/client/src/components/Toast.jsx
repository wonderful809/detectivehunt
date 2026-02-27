import { useState, useEffect, useCallback } from 'react';

let toastId = 0;

export function useToast() {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'info') => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    return { toasts, showToast };
}

export default function ToastContainer({ toasts }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
            ))}
        </div>
    );
}
