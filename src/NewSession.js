import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import Confetti from 'react-confetti';
import './NewSession.css';

const NewSession = () => {
    const { sessionId } = useParams();
    const location = useLocation();
    const { username } = location.state || {};
    const [participants, setParticipants] = useState([]);
    const [votes, setVotes] = useState({});
    const [flipResults, setFlipResults] = useState(null);
    const [creator, setCreator] = useState('');
    const [sessionName, setSessionName] = useState('');
    const [showConfetti, setShowConfetti] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const fetchSessionDetails = async () => {
            try {
                const response = await fetch(`http://localhost:8080/api/sessions/${sessionId}/details/`);
                const result = await response.json();
                if (response.ok) {
                    setParticipants(result.participants);
                    setVotes(result.votes);
                    setCreator(result.created_by);
                    setSessionName(result.name);
                    if (flipResults === null) {
                        setFlipResults(result.vote_results);
                    }
                } else {
                    setErrorMessage(result.error);
                }
            } catch (error) {
                setErrorMessage('Network error occurred.');
            }
        };

        fetchSessionDetails();

        const intervalId = setInterval(fetchSessionDetails, 5000);
        return () => clearInterval(intervalId);
    }, [sessionId, flipResults]);

    const handleVote = async (vote) => {
        try {
            const response = await fetch(`http://localhost:8080/api/sessions/${sessionId}/cast_vote/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, sessionId, vote }),
            });

            const result = await response.json();

            if (response.ok) {
                setSuccessMessage('Vote recorded successfully!');
                setVotes(prevVotes => ({ ...prevVotes, [username]: vote }));
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setErrorMessage(result.error || 'Error recording vote.');
            }
        } catch (error) {
            setErrorMessage('Network error occurred.');
        }
    };

    const handleResetVotes = async () => {
        try {
            const response = await fetch(`http://localhost:8080/api/sessions/${sessionId}/reset_votes/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (response.ok) {
                setSuccessMessage('Votes have been reset successfully!');
                setVotes({});
                setFlipResults(null);
                setTimeout(() => setSuccessMessage(''), 3000); // Clear success message after 3 seconds
            } else {
                setErrorMessage(result.error || 'Error resetting votes.');
            }
        } catch (error) {
            setErrorMessage('Network error occurred.');
        }
    };

    const handleFlipVotes = async () => {
        try {
            const response = await fetch(`http://localhost:8080/api/sessions/${sessionId}/flip_votes/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const result = await response.json();

            if (response.ok) {
                setFlipResults(result.vote_results);
                setSuccessMessage('Votes revealed!');
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 5000);
            } else {
                setErrorMessage(result.error || 'Error flipping votes.');
                setTimeout(() => setErrorMessage(false), 3000);
            }
        } catch (error) {
            setErrorMessage('Network error occurred.');
        }
    };

    const clearVote = async () => {
        try {
            const response = await fetch(`http://localhost:8080/api/sessions/${sessionId}/clear_vote/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, sessionId }),
            });

            if (response.ok) {
                setSuccessMessage('Vote cleared successfully!');
                setVotes(prevVotes => {
                    const newVotes = { ...prevVotes };
                    delete newVotes[username];
                    return newVotes;
                });
            } else {
                const result = await response.json();
                setErrorMessage(result.error || 'Error clearing vote.');
            }
        } catch (error) {
            setErrorMessage('Network error occurred.');
        }
    };

    const isCreator = creator === username;

    return (
        <div className="new-session-container">
            {showConfetti && <Confetti />}
            <h1 className="session-welcome">Welcome, Dev's</h1>
            <h2 className="session-intro">
                You've unlocked the gateway to Session: <span className="session-id">{sessionId}</span> By <span className="session-name">{sessionName}</span>
            </h2>
            <div className="session-id-box">
                <p className="session-storyline">Together we build, estimate, and succeed. Every point matters—choose wisely and shape the future of our sprint!</p>
            </div>

            {successMessage && <div className="success-message">{successMessage}</div>}
            {errorMessage && <div className="error-message">{errorMessage}</div>}

            <div className="participants-box">
                {participants.map((participant, index) => (
                    <div key={index} className="participant-card">
                        <img src={`/icon-${index % 8}.png`} alt="Participant Icon" className="participant-icon" />
                        <span className="participant-name">{participant}</span>
                        {votes[participant] && <span className="badge">Voted</span>}
                        {participant === username && votes[participant] && (
                            <button className="clear-vote-button" onClick={clearVote}>Clear Vote</button>
                        )}
                    </div>
                ))}
            </div>
            <div className="voting-buttons">
                {[1, 3, 5, 8, 13].map((num) => (
                    <button
                        key={num}
                        className={`vote-button ${votes[username] === num ? 'highlighted' : ''}`}
                        onClick={() => handleVote(num)}
                    >
                        <img src={`/vote-${num}-modified.png`} alt={`Vote ${num}`} className="vote-image" />
                    </button>
                ))}
            </div>

            <div className="revel-rest-buttons">
            {isCreator && (
                <>
                    <button className="revel-button" onClick={handleFlipVotes}>Reveal Votes</button>
                    <button className="reset-button" onClick={handleResetVotes}>Reset Votes</button>
                </>
            )}
            </div>

            {flipResults && (
                <div className="flip-results">
                    <h2>Vote Results:</h2>
                    {Object.entries(flipResults).map(([user, vote]) => (
                        <div key={user} className="result-card">
                            <span className="result-user">{user} : </span>
                            <span className="result-vote">{vote}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NewSession;