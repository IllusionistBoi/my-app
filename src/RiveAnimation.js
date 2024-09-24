import React, { useState, useRef } from 'react';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';
import riveFile from './login-teddy.riv'; // Ensure the path is correct
import { useNavigate } from 'react-router-dom';

const RiveAnimation = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [showSessionNameInput, setShowSessionNameInput] = useState(false);
  const [showSessionIdInput, setShowSessionIdInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const inputRef = useRef(null);

  const { rive, RiveComponent } = useRive({
    src: riveFile,
    stateMachines: 'Login Machine',
    autoplay: true,
  });

  const isCheckingInput = useStateMachineInput(rive, 'Login Machine', 'isChecking');
  const isHandsUpInput = useStateMachineInput(rive, 'Login Machine', 'isHandsUp');
  const numLookInput = useStateMachineInput(rive, 'Login Machine', 'numLook');
  const trigSuccessInput = useStateMachineInput(rive, 'Login Machine', 'trigSuccess');
  const trigFailInput = useStateMachineInput(rive, 'Login Machine', 'trigFail');
  const trigFailInputSessionId = useStateMachineInput(rive, 'Login Machine', 'trigFailInput');

  const handleUsernameChange = (event) => {
    const value = event.target.value;
    setUsername(value);

    if (isCheckingInput) {
      isCheckingInput.value = true;
    }

    if (numLookInput) {
      const inputWidth = inputRef.current?.offsetWidth || 100;
      const multiplier = inputWidth / 100;
      numLookInput.value = value.length * multiplier;
    }

    // Unhide face when username changes
    if (isHandsUpInput) {
      isHandsUpInput.value = false;
    }
  };

  const handleSessionIdChange = (event) => {
    const value = event.target.value;
    setSessionId(value);

    if (isHandsUpInput) {
      isHandsUpInput.value = true;
    }
  };

  const handleSessionNameChange = (event) => {
    const value = event.target.value;
    setSessionName(value);

    if (isHandsUpInput) {
      isHandsUpInput.value = true;
    }
  };

  const resetAndTriggerFail = () => {
    if (trigFailInput) {
      trigFailInput.value = false; // Reset the animation state
      trigFailInput.fire(); // Trigger the animation
    }
    if (trigFailInputSessionId) {
      trigFailInputSessionId.value = false; // Reset the animation state for session ID
      trigFailInputSessionId.fire(); // Trigger the animation
    }
  };

  const handleShowSessionNameInput = () => {
    if (!username) {
      setErrorMessage('Name is required Dev');
      resetAndTriggerFail();
      return;
    }
    setErrorMessage('');
    setShowSessionNameInput(true);
    setShowSessionIdInput(false); // Hide Session ID input if it was previously shown
  };

  const handleShowSessionIdInput = () => {
    if (!username) {
      setErrorMessage('Name is required Dev');
      resetAndTriggerFail();
      return;
    }
    setErrorMessage('');
    setShowSessionIdInput(true);
    setShowSessionNameInput(false); // Hide Session Name input if it was previously shown
  };

  const handleCreateSession = async (event) => {
    event.preventDefault();

    if (!username) {
      setErrorMessage('Username is required Dev');
      resetAndTriggerFail();
      return;
    }

    if (!sessionName) {
      setErrorMessage('Session name is required Dev');
      resetAndTriggerFail();
      return;
    }

    setErrorMessage('');
    setSuccessMessage(''); // Reset success message

    try {
      const response = await fetch('http://localhost:8080/api/sessions/create/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, session_name: sessionName }), // Send session name
      });

      const result = await response.json();

      if (response.ok) {
        if (trigSuccessInput) trigSuccessInput.fire();
        setSuccessMessage(`Session created successfully Dev! Session ID: ${result.session.session_id}`);
        navigate(`/new-session/${result.session.session_id}`, { state: { username } });
      } else {
        if (trigFailInput) trigFailInput.fire();
        setErrorMessage(result.error || 'Failed to create session Dev');
      }
    } catch (error) {
      setErrorMessage('Network error');
      resetAndTriggerFail();
    }
  };

  const handleJoinSession = async (event) => {
    event.preventDefault();

    if (!username) {
      setErrorMessage('Username is required Dev');
      resetAndTriggerFail();
      return;
    }

    if (!sessionId) {
      setErrorMessage('Session ID is required Dev');
      resetAndTriggerFail();
      return;
    }

    setErrorMessage('');
    setSuccessMessage(''); // Reset success message

    try {
      const response = await fetch('http://localhost:8080/api/sessions/join/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, sessionId }),
      });

      const result = await response.json();

      if (response.ok) {
        if (trigSuccessInput) trigSuccessInput.fire();
        setSuccessMessage('Session joined successfully Dev!');
        navigate(`/new-session/${sessionId}`, { state: { username } });
      } else {
        if (trigFailInput) trigFailInput.fire();
        setErrorMessage(result.error || 'Session not found');
      }
    } catch (error) {
      setErrorMessage('Network error');
      resetAndTriggerFail();
    }
  };

  return (
    <div className="rive-container">
      <RiveComponent style={{ width: '500px', height: '500px' }} />
      <h1>Planning Poker</h1>
      <form>
        <div className="input-group">
          <label htmlFor="username">Your Name</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={handleUsernameChange}
            ref={inputRef}
          />
        </div>

        {showSessionNameInput && (
          <div className="input-group">
            <label htmlFor="session-name">Session Name</label>
            <input
              type="text"
              id="session-name"
              value={sessionName}
              onChange={handleSessionNameChange}
            />
          </div>
        )}

        {showSessionIdInput && (
          <div className="input-group">
            <label htmlFor="session-id">Session ID</label>
            <input
              type="text"
              id="session-id"
              value={sessionId}
              onChange={handleSessionIdChange}
            />
          </div>
        )}

        <div className="button-group">
          {!showSessionNameInput && !showSessionIdInput && (
            <>
              <button type="button" className="show-session-name-button" onClick={handleShowSessionNameInput}>
                Start Creating Session
              </button>
              <button type="button" className="show-session-id-button" onClick={handleShowSessionIdInput}>
                Join Session
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

        {errorMessage && <p className="error-message">{errorMessage}</p>}
        {successMessage && <p className="success-message">{successMessage}</p>}
      </form>
    </div>
  );
};

export default RiveAnimation;
