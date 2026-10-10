import React, { useState } from "react";
import { BrowserRouter as Router, Navigate, Outlet, Routes, Route, useLocation } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import Box from "@mui/material/Box";

import EditorPage from "./pages/EditorPage";
import Header from "./components/Header.jsx";
import PageContent from "./components/PageContent.jsx";
import RepertoireFrame from "./components/RepertoireFrame.jsx";
import SetlistPage from "./pages/SetlistPage.jsx";
import ImportPage from "./pages/ImportPage.jsx";
import BandPage from "./pages/BandPage.jsx";
import InvitePage from "./pages/InvitePage.jsx";
import PendingInviteRedirect from "./auth/PendingInviteRedirect.jsx";
import { BandProvider } from "./band/BandContext.jsx";
import NoteConflictDialog from "./performance/NoteConflictDialog.jsx";
import PerformanceBanner from "./performance/PerformanceBanner.jsx";
import { PerformanceModeProvider } from "./performance/PerformanceModeContext.jsx";
import OfflineSnapshotRefresh from "./snapshot/OfflineSnapshotRefresh.jsx";

function RootEntry() {
    const location = useLocation();
    const auth = useAuth();
    const params = new URLSearchParams(location.search);
    const awaitingCallback = !auth.isAuthenticated
        && !params.has('error')
        && (params.has('code') || params.has('state'));
    if (awaitingCallback) {
        return null;
    }
    return <Navigate to="/repertoire" replace />;
}

function RepertoireLayout() {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: { xs: "calc(100vh - 56px)", sm: "calc(100vh - 64px)" },
                minHeight: 0,
            }}
        >
            <RepertoireFrame />
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
                <Outlet />
            </Box>
        </Box>
    );
}

export default function App() {
    const [decisionsOpen, setDecisionsOpen] = useState(false);
    return (
        <PerformanceModeProvider>
            <BandProvider>
                <Router>
                    <OfflineSnapshotRefresh />
                    <PendingInviteRedirect />
                    <Header />
                    <NoteConflictDialog open={decisionsOpen} onClose={() => setDecisionsOpen(false)} />
                    <PageContent>
                        <PerformanceBanner onOpenDecisions={() => setDecisionsOpen(true)} />
                        <Routes>
                            <Route path="/" element={<RootEntry />} />
                            <Route element={<RepertoireLayout />}>
                                <Route path="/repertoire" element={<EditorPage />} />
                                <Route path="/editor" element={<EditorPage />} />
                                <Route path="/setlist" element={<SetlistPage />} />
                                <Route path="/import" element={<ImportPage />} />
                            </Route>
                            <Route path="/band" element={<BandPage />} />
                            <Route path="/invite/:token" element={<InvitePage />} />
                        </Routes>
                    </PageContent>
                </Router>
            </BandProvider>
        </PerformanceModeProvider>
    );
}
