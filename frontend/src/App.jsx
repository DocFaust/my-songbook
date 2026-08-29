import React from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";

import Home from "./pages/Home";
import EditorPage from "./pages/EditorPage";
import Header from "./components/Header.jsx";
import PageContent from "./components/PageContent.jsx";
import SetlistPage from "./pages/SetlistPage.jsx";
import ImportPage from "./pages/ImportPage.jsx";
import BandPage from "./pages/BandPage.jsx";
import InvitePage from "./pages/InvitePage.jsx";
import { loadPendingInviteToken } from "./auth/inviteStorage.js";
import { BandProvider } from "./band/BandContext.jsx";

function PendingInviteRestore() {
    const location = useLocation();
    const inviteToken = loadPendingInviteToken();
    if (!inviteToken) {
        return null;
    }
    const invitePath = `/invite/${inviteToken}`;
    if (location.pathname === invitePath) {
        return null;
    }
    return <Navigate to={invitePath} replace />;
}

export default function App() {
    return (
        <BandProvider>
            <Router>
                <PendingInviteRestore />
                <Header />
                <PageContent>
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
    );
}
