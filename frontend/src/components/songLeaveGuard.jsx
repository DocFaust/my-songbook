/* eslint-disable react-refresh/only-export-components -- hook and provider share one leave-guard context */
import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SongLeaveGuardContext = createContext({
    register() {
        return () => {};
    },
    requestLeave(action) {
        action();
    },
});

export function SongLeaveGuardProvider({ children }) {
    const guardRef = useRef(null);

    const register = useCallback((guard) => {
        guardRef.current = guard;
        return () => {
            if (guardRef.current === guard) {
                guardRef.current = null;
            }
        };
    }, []);

    const requestLeave = useCallback((action) => {
        const guard = guardRef.current;
        if (guard?.isDirty()) {
            guard.confirm(action);
            return;
        }
        action();
    }, []);

    const value = useMemo(() => ({ register, requestLeave }), [register, requestLeave]);

    return (
        <SongLeaveGuardContext.Provider value={value}>
            {children}
        </SongLeaveGuardContext.Provider>
    );
}

export function useSongLeaveGuard() {
    return useContext(SongLeaveGuardContext);
}

function isPlainClick(event) {
    return event.button === 0
        && !event.metaKey
        && !event.altKey
        && !event.ctrlKey
        && !event.shiftKey;
}

export function useInterceptLeave() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { requestLeave } = useSongLeaveGuard();

    return useCallback((event, to) => {
        if (event.defaultPrevented || !isPlainClick(event)) {
            return;
        }
        const path = String(to).split(/[?#]/)[0];
        event.preventDefault();
        if (path === pathname) {
            return;
        }
        requestLeave(() => navigate(to));
    }, [navigate, pathname, requestLeave]);
}
