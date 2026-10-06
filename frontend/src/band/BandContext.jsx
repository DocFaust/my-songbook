/* eslint-disable react-refresh/only-export-components -- hook and provider share one band context */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { apiBaseUrl } from '../auth/authConfig.js';
import { isBackendUnreachableError } from '../performance/backendReachability.js';
import { usePerformanceMode } from '../performance/PerformanceModeContext.jsx';
import { readPerformanceBands } from '../performance/musicRead.js';
import { loadActiveBandId, saveActiveBandId } from './bandStorage.js';

const BandContext = createContext({
    bands: [],
    activeBand: null,
    loading: false,
    isAuthenticated: false,
    createBand: async () => {
        throw new Error('Band context is not available');
    },
    selectBand: () => {},
    refreshBands: async () => {},
    dropBand: () => {},
});

export function useBand() {
    return useContext(BandContext);
}

export function BandProvider({ children }) {
    const auth = useAuth();
    const performance = usePerformanceMode();
    const performanceActive = performance.active;
    const performanceUserId = performance.userId;
    const performanceRevision = performance.revision;
    const reportUnreachable = performance.reportUnreachable;
    const accessToken = auth.user?.access_token;
    const authLoading = auth.isLoading;
    const isAuthenticated = Boolean(auth.isAuthenticated && accessToken);
    const currentSession = isAuthenticated ? accessToken : null;

    const [sessionToken, setSessionToken] = useState(currentSession);
    const [bands, setBands] = useState([]);
    const [activeBand, setActiveBand] = useState(null);
    const [loadedToken, setLoadedToken] = useState(null);
    const listGeneration = useRef(0);

    if (!performanceActive && sessionToken !== currentSession) {
        setSessionToken(currentSession);
        setBands([]);
        setActiveBand(null);
        setLoadedToken(null);
    }

    const applyBandList = useCallback((list, preferredBandId) => {
        const storedId = preferredBandId ?? loadActiveBandId();
        const restored = list.find((band) => band.id === storedId) ?? list[0] ?? null;
        setBands(list);
        setActiveBand(restored);
        saveActiveBandId(restored?.id ?? null);
    }, []);

    useEffect(() => {
        // Auth starts unauthenticated while the session is restored. Clearing
        // the stored band in that window would drop the user's last selection.
        if (authLoading || performanceActive) {
            return undefined;
        }
        if (!isAuthenticated) {
            saveActiveBandId(null);
            return undefined;
        }

        const generation = ++listGeneration.current;
        let cancelled = false;

        fetch(`${apiBaseUrl}/api/bands`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                return response.json();
            })
            .then((data) => {
                if (cancelled || generation !== listGeneration.current) {
                    return;
                }
                applyBandList(Array.isArray(data) ? data : []);
                setLoadedToken(accessToken);
            })
            .catch((error) => {
                if (!cancelled && generation === listGeneration.current) {
                    setBands([]);
                    setActiveBand(null);
                    setLoadedToken(accessToken);
                    if (isBackendUnreachableError(error)) {
                        reportUnreachable();
                    }
                }
            });

        return () => {
            cancelled = true;
        };
    }, [authLoading, isAuthenticated, accessToken, applyBandList, performanceActive, reportUnreachable]);

    useEffect(() => {
        if (!performanceActive || !performanceUserId) {
            return undefined;
        }
        let cancelled = false;
        readPerformanceBands(performanceUserId)
            .then((rows) => {
                if (cancelled) {
                    return;
                }
                const list = Array.isArray(rows) ? rows : [];
                applyBandList(list);
                setLoadedToken('performance');
            })
            .catch(() => {
                if (!cancelled) {
                    setBands([]);
                    setActiveBand(null);
                    setLoadedToken('performance');
                }
            });
        return () => {
            cancelled = true;
        };
    }, [performanceActive, performanceUserId, performanceRevision, applyBandList]);

    const selectBand = (bandId) => {
        const next = bands.find((band) => band.id === bandId);
        if (!next) {
            return;
        }
        setActiveBand(next);
        saveActiveBandId(next.id);
    };

    const dropBand = useCallback((bandId) => {
        const next = bands.filter((band) => band.id !== bandId);
        const restored = next.find((band) => band.id === loadActiveBandId()) ?? next[0] ?? null;
        setBands(next);
        setActiveBand(restored);
        saveActiveBandId(restored?.id ?? null);
    }, [bands]);

    const refreshBands = useCallback(async (preferredBandId) => {
        if (!accessToken) {
            return [];
        }
        const response = await fetch(`${apiBaseUrl}/api/bands`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        const list = Array.isArray(data) ? data : [];
        applyBandList(list, preferredBandId);
        return list;
    }, [accessToken, applyBandList]);

    const createBand = async (name) => {
        const response = await fetch(`${apiBaseUrl}/api/bands`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        const created = await response.json();
        listGeneration.current += 1;
        setBands((previous) => [...previous, created]);
        setActiveBand(created);
        saveActiveBandId(created.id);
        return created;
    };

    return (
        <BandContext.Provider
            value={{
                bands: (isAuthenticated || performanceActive) ? bands : [],
                activeBand: (isAuthenticated || performanceActive) ? activeBand : null,
                loading: performanceActive
                    ? loadedToken !== 'performance'
                    : isAuthenticated && loadedToken !== accessToken,
                isAuthenticated,
                createBand,
                selectBand,
                refreshBands,
                dropBand,
            }}
        >
            {children}
        </BandContext.Provider>
    );
}
