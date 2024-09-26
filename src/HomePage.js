import React, { useState, useRef } from 'react';
import RiveAnimation from './RiveAnimation';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
  const [username, setUsername] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [showSessionNameInput, setShowSessionNameInput] = useState(false);
  const [showSessionIdInput, setShowSessionIdInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [triggerFailAnimation, setTriggerFailAnimation] = useState(false);
  const [triggerSuccessAnimation, setTriggerSuccessAnimation] = useState(false);
  const [isHandsUpInput, setIsHandsUpInput] = useState(null); // Add state for isHandsUpInput
  const [typingTimer, setTypingTimer] = useState(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const handleUsernameChange = (event) => {
    setUsername(event.target.value);
  };

  const handleSessionIdChange = (event) => {
    setSessionId(event.target.value);
  };

  const handleSessionNameChange = (event) => {
    setSessionName(event.target.value);

    // Hide face (trigger "hands up") while typing
    if (isHandsUpInput) {
      isHandsUpInput.value = true;
    }

    // Clear previous typing timer if it's still running
    if (typingTimer) {
      clearTimeout(typingTimer);
    }

    // Set a new timer to unhide the face after typing stops
    setTypingTimer(setTimeout(() => {
      if (isHandsUpInput) {
        isHandsUpInput.value = false; // Reset the animation state (unhide face)
      }
    }, 500)); // Adjust the delay as needed (1.2 seconds in this case)
  };

  const resetAndTriggerFail = () => {
    setTriggerFailAnimation(true);
    setTimeout(() => setTriggerFailAnimation(false), 1000);  // Reset after the animation triggers
  };

  const showError = (message) => {
    setErrorMessage(message);
    resetAndTriggerFail();
    setTimeout(() => setErrorMessage(''), 3000);  // Clear error after 3 seconds
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTriggerSuccessAnimation(true);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleShowSessionNameInput = () => {
    if (!username) {
      showError('Name is required');
      return;
    }
    setShowSessionNameInput(true);
    setShowSessionIdInput(false);
  };

  const handleShowSessionIdInput = () => {
    if (!username) {
      showError('Name is required');
      return;
    }
    setShowSessionIdInput(true);
    setShowSessionNameInput(false);
  };

  const handleCreateSession = async (event) => {
    event.preventDefault();
    if (!username || !sessionName) {
      showError('Username and session name are required');
      return;
    }
    try {
      const response = await fetch('https://l9c2jn1c-8080.euw.devtunnels.ms/api/sessions/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, session_name: sessionName }),
      });

      const result = await response.json();

      if (response.ok) {
        showSuccess(`Session created successfully!`);
        setTimeout(() => {
          navigate(`/new-session/${result.session.session_id}`, { state: { username } });
        }, 3000);
      } else {
        showError('Failed to create session');
      }
    } catch (error) {
      showError('Network error');
    }
  };

  const handleJoinSession = async (event) => {
    event.preventDefault();
    if (!username || !sessionId) {
      showError('Username and session ID are required');
      return;
    }
    try {
      const response = await fetch('https://l9c2jn1c-8080.euw.devtunnels.ms/api/sessions/join/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, sessionId }),
      });

      if (response.ok) {
        showSuccess('Session joined successfully!');
        navigate(`/new-session/${sessionId}`, { state: { username } });
      } else {
        showError('Session not found');
      }
    } catch (error) {
      showError('Network error');
    }
  };

  return (
    <div className="home-page">
      <RiveAnimation username={username} sessionName={sessionName} sessionId={sessionId} handleFailAnimation={triggerFailAnimation} handleSuccessAnimation={triggerSuccessAnimation}
        inputRef={inputRef} setIsHandsUpInput={setIsHandsUpInput}/>
      <h1>Planning Poker</h1>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}
      <form>
        <div className="input-group">
          <label htmlFor="username">Your Name</label>
          <input type="text" id="username" value={username}
          onChange={handleUsernameChange} ref={inputRef} />
        </div>

        {showSessionNameInput && (
          <div className="input-group">
            <label htmlFor="session-name">Session Name</label>
            <input type="text" id="session-name" value={sessionName}
            onChange={handleSessionNameChange}/>
          </div>
        )}

        {showSessionIdInput && (
          <div className="input-group">
            <label htmlFor="session-id">Session ID</label>
            <input type="text" id="session-id" value={sessionId}
              onChange={handleSessionIdChange}
            />
          </div>
        )}

        <div className="button-group">
          {!showSessionNameInput && !showSessionIdInput && (
            <>
              <button type="button" className="show-session-name-button"
              onClick={handleShowSessionNameInput}> Start Creating Session
              </button>
              <button type="button" className="show-session-id-button"
              onClick={handleShowSessionIdInput}> Join Session
              </button>
            </>
          )}

          {showSessionNameInput && (
            <button type="button" className="create-session-button" onClick={handleCreateSession}>
              Start Session
            </button>
          )}

          {showSessionIdInput && (
            <button type="button" className="enter-session-button" onClick={handleJoinSession}>
              Enter Session
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default HomePage;
