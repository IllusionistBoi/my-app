import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useParticipants } from './ParticipantContext';
import Confetti from 'react-confetti';
import './NewSession.css';
import Card from './Card';
import Switch from './Switch';
import Button from "./Button";
import Loader from './Loader';
import BrokenTextButton from "./BrokenTextButton";
import { API } from "./config";

const NewSession = () => {
    const { sessionId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();  // Initialize useNavigate
    const { username } = location.state || {};
    const { participants, updateParticipants } = useParticipants(); // Use context
    const [votes, setVotes] = useState({});
    const [flipResults, setFlipResults] = useState(null);
    const [creator, setCreator] = useState('');
    const [sessionName, setSessionName] = useState('');
    const [showConfetti, setShowConfetti] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSpectator, setIsSpectator] = useState(false);
    const [setSpectatorButtonDisabled] = useState(false);
    const isCreator = creator === username;

    useEffect(() => {
        const fetchSessionDetails = async () => {
            try {
                const response = await fetch(`${API}/sessions/${sessionId}/details/`);
                const result = await response.json();
                if (response.ok) {
                    updateParticipants(result.participants);
                    setVotes(result.votes);
                    setCreator(result.created_by);
                    setSessionName(result.name);
                    if (result.votes[username.toLowerCase()]) {
                        setIsSpectator(result.votes[username.toLowerCase()].is_spectator);
                    }
                    if (flipResults === null) {
                        setFlipResults(result.vote_results);
                    }
                } else if (response.status === 404) {
                    clearInterval(intervalId); // Stop polling if session is not found
                    setErrorMessage('Session Ended. Navigating to the homepage...');
                    setTimeout(() => {
                        navigate('/');
                    }, 5000);
                    }
            } catch (error) {
                setErrorMessage('Network error occurred.');
            }
        };

        fetchSessionDetails();
        const intervalId = setInterval(fetchSessionDetails, 5000);
        return () => clearInterval(intervalId);
    }, [sessionId, flipResults, username, navigate]);

    const handleVote = async (vote) => {
        if (isSpectator) return;

        try {
          const response = await fetch(`${API}/sessions/${sessionId}/cast_vote/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.toLowerCase(), sessionId, vote, is_spectator: isSpectator }),
          });

          const result = await response.json();

          if (response.ok) {
            setSuccessMessage('Vote recorded successfully!');
            setVotes(prevVotes => ({ ...prevVotes, [username.toLowerCase()]: { vote, is_spectator: isSpectator } }));
            setTimeout(() => setSuccessMessage(''), 3000);
          } else {
            setErrorMessage(result.error || 'Error recording vote.');
          }
        } catch (error) {
          setErrorMessage('Unable To Cast User Votes');
          setTimeout(() => setErrorMessage(''), 3000);
        }
      };

    const handleUserStatus = async (is_spectator) => {
        try {
            const response = await fetch(`${API}/sessions/${sessionId}/make_spectator/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, is_spectator }),
            });
        if (response.ok) {
            setIsSpectator(is_spectator);  // Use the local variable, not backend response result.is_spectator
            setVotes(prevVotes => {
                const newVotes = { ...prevVotes };
                if (isSpectator) {
                    newVotes[username] = { vote: null, is_spectator: true };
                } else {
                    // Check if newVotes[username] exists before accessing is_spectator
                    if (newVotes[username]) {
                        newVotes[username].is_spectator = false;
                    } else {
                        // If it doesn't exist, create it with the desired properties
                        newVotes[username] = { vote: null, is_spectator: false };
                    }
                }
                return newVotes;
            });

            if (isSpectator) {
                await clearVoteSpectator(); // Clear vote if user becomes a spectator
            }

            setSuccessMessage('Spectator status updated!');
            setTimeout(() => setSuccessMessage(''), 3000);
        }  else {
            const result = await response.json();
            setErrorMessage(result.error || 'Unable to update spectator status');
            setTimeout( () => setErrorMessage(''), 3000)
        }

        } catch (error) {
            setErrorMessage('Error updating spectator status');
            setTimeout(() => setErrorMessage(''), 3000);
        }
    }

    const toCamelCase = (str) => {
        return str
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const handleResetVotes = async () => {
        try {
            const response = await fetch(`${API}/sessions/${sessionId}/reset_votes/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (response.ok) {
                setSuccessMessage('Votes have been reset successfully!');
                setVotes(prevVotes => {
                    const updatedVotes = { ...prevVotes };
                    Object.keys(updatedVotes).forEach(username => {
                        updatedVotes[username].vote = null; // Set vote to null
                    });
                    return updatedVotes;
                });
                setFlipResults(null);
                setSpectatorButtonDisabled(false);
                setTimeout(() => setSuccessMessage(''), 3000); // Clear success message after 3 seconds
            } else {
                setErrorMessage(result.error || 'Error resetting votes.');
            }
        } catch (error) {
            setErrorMessage('Unable to Rest User Votes');
            setTimeout( () => setErrorMessage('', 3000))
        }
    };

    const handleFlipVotes = async () => {
        try {
            const response = await fetch(`${API}/sessions/${sessionId}/flip_votes/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const result = await response.json();

            if (response.ok) {
                setFlipResults(result.vote_results);
                setSuccessMessage('Votes revealed!');
                setSpectatorButtonDisabled(false);
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 5000);
            } else {
                setErrorMessage(result.error || 'Error flipping votes.');
                setTimeout(() => setErrorMessage(false), 3000);
            }
        } catch (error) {
            setErrorMessage('Unable to Generate Poker Result');
            setTimeout( () => setErrorMessage('', 3000))        }
    };

    const clearVote = async () => {
        try {
            const response = await fetch(`${API}/sessions/${sessionId}/clear_vote/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, sessionId }),
            });

            if (response.ok) {
                setVotes(prevVotes => {
                    const newVotes = { ...prevVotes };
                    delete newVotes[username];
                    return newVotes;
                });
                setSuccessMessage('Vote cleared successfully!');
                setTimeout( () => setErrorMessage('', 3000))
            } else {
                const result = await response.json();
                setErrorMessage(result.error || 'Error clearing vote.');
            }
        } catch (error) {
            setErrorMessage('Unable to Clear User Votes');
            setTimeout( () => setErrorMessage('', 3000))        }
    };

    const clearVoteSpectator = async () => {
        try {
            const response = await fetch(`${API}/sessions/${sessionId}/clear_vote/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, sessionId }),
            });

            if (response.ok) {
                setVotes(prevVotes => {
                    const newVotes = { ...prevVotes };

                    // Instead of deleting the entire user's entry, just set vote to null
                    if (newVotes[username]) {
                        newVotes[username].vote = null;
                    }

                    return newVotes;
                });
                setSuccessMessage(`Spectator's votes cleared successfully!`);
                setTimeout( () => setErrorMessage('', 3000))
            } else {
                const result = await response.json();
                setErrorMessage(result.error || 'Error clearing vote.');
            }
        } catch (error) {
            setErrorMessage('Unable to Clear User Votes');
            setTimeout( () => setErrorMessage('', 3000))        }
    };

    const handleReturnHome = () => {
        navigate('/');
    };

    const handleCopySession = () => {
        navigator.clipboard.writeText(sessionId);
        setSuccessMessage('Session ID copied to clipboard!');
        setTimeout(() => setSuccessMessage(''), 3000);
    }

    const handleRemoveUser = async (participant) => {
        try {
            const response = await fetch(`${API}/sessions/${sessionId}/remove_user/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: participant }),
            });

            const result = await response.json();

            if (response.ok) {
                setSuccessMessage(`${participant} has been removed from the session.`);
                updateParticipants(prevParticipants => prevParticipants.filter(user => user !== participant));
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setErrorMessage(result.error || 'Error removing user.');
                setTimeout(() => setErrorMessage(''), 3000);
            }
        } catch (error) {
            setErrorMessage('Unable to remove user.');
            setTimeout(() => setErrorMessage(''), 3000);
        }
    }

    const handleEndSession = async () => {
        try {
            const response = await fetch(`${API}/sessions/${sessionId}/delete_session/`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();
            if (response.ok) {
                setSuccessMessage('Session ended successfully! Navigating to the homepage...');
                setTimeout(() => {
                    navigate('/'); // Navigate to homepage
                }, 2000); // Navigate after 2 seconds for visibility
            } else {
                setErrorMessage(result.error || 'Error ending session.');
                setTimeout(() => setErrorMessage(''), 3000);
            }
        } catch (error) {
            setErrorMessage('Error ending session. Please try again.');
            setTimeout(() => setErrorMessage(''), 3000);
        }
    };



    return (
        <div className="new-session-container">
            {showConfetti && <Confetti />}
            <Loader />
            <h1 className="session-welcome">
                Welcome To {toCamelCase(sessionName)}, Dev's</h1>
            <div className = "session-box">
                <BrokenTextButton text={`You've Unlocked The Gateway To Session: ${sessionId} By ${toCamelCase(creator)}`} />
            </div>
            {successMessage && <div className="success-message">{successMessage}</div>}
            {errorMessage && <div className="error-message">{errorMessage}</div>}

            <div className="participants-box">
                {participants.map((participant, index) => (
                    <div key={index} className="participant-card">
                        <img src={`/icon-${index % 8}.png`} alt="Participant Icon" className="participant-icon" />
                        <span className="participant-name">{toCamelCase(participant)}</span>
                        {/* Show "Spectator" label if the user is a spectator */}
                        {votes[participant]?.is_spectator ? (
                            <span className="spectator-badge">Spectator</span>
                        ) : (
                            /* Show "Voted" badge only if the user is not a spectator and has voted */
                            votes[participant]?.vote && <span className="badge">Voted</span>
                        )}

                        {/* Show "Clear Vote" button only for the current user who has voted and is not a spectator */}
                        {participant === username.toLowerCase() && votes[participant]?.vote && !votes[participant]?.is_spectator && (
                            <button className="clear-vote-button" onClick={clearVote}>Clear Vote</button>
                        )}

                        {/* Show "Remove User" button only for the session creator */}
                        {isCreator && (
                            <button className="remove-user-button" onClick={() => handleRemoveUser(participant)}>Remove User</button>
                        )}
                    </div>
                ))}
            </div>

            <div className="voting-cards">
                {[1, 2, 3, 5, 8, 13].map((num) => (
                    <Card
                    key={num}
                    value={num}
                    onClick={handleVote}
                    isDisabled={isSpectator}
                    isHighlighted={votes[username]?.vote === num}
                    isFlipped={votes[username]?.vote === num}
                    />
                ))}
            </div>

            <div className="revel-rest-buttons">

            {isCreator && (
            <div className="flex justify-between space-x-4">
                <Button label="Reveal Votes" onClick={handleFlipVotes} />
                <Button label="Reset Votes" onClick={handleResetVotes} />
                <Button label="End Session" onClick={handleEndSession} />
            </div>
            )}
            </div>

            {flipResults && (
                <div className="flip-results">
                    <h2>Vote Results</h2>
                    {Object.entries(flipResults).map(([user, { vote, is_spectator }]) => (
                        <div key={user} className="result-card">
                            <span className="result-user">{toCamelCase(user)} : </span>
                            <span className="result-vote">{vote}</span> {/* Display vote directly */}
                            <span className="result-spectator">{is_spectator ? '(Spectator)' : ''}</span> {/* Optional display for spectator */}
                    </div>
                    ))}
                </div>
            )}


            <button className="return-home-button" onClick={handleReturnHome}>Return to Homepage</button>
            <button className="copy-session-link" onClick={handleCopySession}>Copy Session ID</button>

           <div className="spectator-toggle">
                <Switch
                    isChecked={isSpectator}
                    onChange={() => {
                        handleUserStatus(!isSpectator);
                    }}
                />
                <BrokenTextButton text={`You are a ${isSpectator ? "Spectator" : "Participant"}`} />
            </div>


        </div>
    );
};

export default NewSession;