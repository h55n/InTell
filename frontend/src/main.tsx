import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { InvestigatePage } from './pages/InvestigatePage';
import { ReportPage } from './pages/ReportPage';
import { BulkPage } from './pages/BulkPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<InvestigatePage />} />
        <Route path="/report/:id" element={<ReportPage />} />
        <Route path="/bulk" element={<BulkPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
