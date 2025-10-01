import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

import Home from "./pages/Home";
import EditorPage from "./pages/EditorPage";
import Header from "./components/Header.jsx";
import SetlistPage from "./pages/SetlistPage.jsx";
import ImportPage from "./pages/ImportPage.jsx";

export default function App() {
    return (
        <Router>
            <Header />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/editor" element={<EditorPage />} />
                <Route path="/setlist" element={<SetlistPage />} />
                <Route path="/import" element={<ImportPage />} />
            </Routes>
        </Router>

    );
}
