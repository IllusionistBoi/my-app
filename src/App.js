import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage';
import NewSession from './NewSession';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new-session/:sessionId" element={<NewSession />} />
      </Routes>
    </Router>
  );
};

export default App;
