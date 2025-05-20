import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage';
import { ParticipantProvider } from './ParticipantContext';
import NewSession from './NewSession';
import "./index.css";

const App = () => {
  return (
  <ParticipantProvider>
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new-session/:sessionId" element={<NewSession />} />
      </Routes>
    </Router>
    </ParticipantProvider>
  );
};

export default App;
