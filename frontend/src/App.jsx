import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import EditorPage from "./pages/EditorPage";
import Header from "./components/Header.jsx";
import PageContent from "./components/PageContent.jsx";
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
                            <Route path="/" element={<Home />} />
                            <Route path="/editor" element={<EditorPage />} />
                            <Route path="/setlist" element={<SetlistPage />} />
                            <Route path="/import" element={<ImportPage />} />
                            <Route path="/band" element={<BandPage />} />
                            <Route path="/invite/:token" element={<InvitePage />} />
                        </Routes>
                    </PageContent>
                </Router>
            </BandProvider>
        </PerformanceModeProvider>
    );
}
