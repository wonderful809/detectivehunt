import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PlayerApp from './pages/PlayerApp';
import AdminDashboard from './pages/AdminDashboard';
import PrintQR from './pages/PrintQR';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<PlayerApp />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/print-qr" element={<PrintQR />} />
            </Routes>
        </BrowserRouter>
    );
}
