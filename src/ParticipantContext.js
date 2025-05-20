import React, { createContext, useContext, useState } from 'react';

const ParticipantContext = createContext();

export const useParticipants = () => {
    return useContext(ParticipantContext);
};

export const ParticipantProvider = ({ children }) => {
    const [participants, setParticipants] = useState([]);

    const updateParticipants = (newParticipants) => {
        setParticipants(newParticipants);
    };

    return (
        <ParticipantContext.Provider value={{ participants, updateParticipants }}>
            {children}
        </ParticipantContext.Provider>
    );
};
