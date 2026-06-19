import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import EditorPage from "./pages/EditorPage";
import Header from "./components/Header.jsx";
import PageContent from "./components/PageContent.jsx";
import SetlistPage from "./pages/SetlistPage.jsx";
import ImportPage from "./pages/ImportPage.jsx";

export default function App() {
    return (
        <Router>
            <Header />
            <PageContent>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/editor" element={<EditorPage />} />
                    <Route path="/setlist" element={<SetlistPage />} />
                    <Route path="/import" element={<ImportPage />} />
                </Routes>
            </PageContent>
        </Router>
    );
}
