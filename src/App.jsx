import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import Transactions from './pages/Transactions';
import AddTransactionPage from './pages/AddTransactionPage';
import WorkingPage from './pages/WorkingPage';
import DuePage from './pages/DuePage';
import Login from './pages/Login';

const AppContent = () => {
  const { authSession } = useAppContext();

  if (!authSession) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<WorkingPage />} />
          <Route path="transactions" element={<AddTransactionPage />} />
          <Route path="ledger" element={<Transactions />} />
          <Route path="due" element={<DuePage />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
