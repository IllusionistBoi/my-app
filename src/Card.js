import React from "react";
import './Card.css';
import Vote1 from './skateboard.svg';
import Vote2 from './bicycle-1.svg';
import Vote3 from './scooter-1.svg';
import Vote5 from './motorcycle.svg';
import Vote8 from './boat.svg';
import Vote13 from './ship.svg';

const Card = ({ value, onClick, isDisabled, isHighlighted, isFlipped }) => {
    const voteImages = {
        1: Vote1,
        2: Vote2,
        3: Vote3,
        5: Vote5,
        8: Vote8,
        13: Vote13,
    };

    const voteDescriptions = {
        1: "Quick task, less than a day",
        2: "Small task, 1-2 days",
        3: "Moderate task, 2-3 days",
        5: "Significant effort, 3-5 days",
        8: "Large task, up to a week",
        13: "Very large task, 1-2 weeks"
    };

    return (
      <div
        onClick={!isDisabled ? () => onClick(value) : undefined}
        style={{ cursor: isDisabled ? "not-allowed" : "pointer" }}
      >
        <div className={`card ${isFlipped ? "flipped" : ""} ${isHighlighted ? "highlighted" : ""}`}>
          <div className="content">
            <div className="back">
              <div className="back-content">
                <img src={voteImages[value]} alt={`Vote icon ${value}`} width="48" height="48" />
                <strong>{value}</strong>
              </div>
            </div>
            <div className="front">
              <div className="img">
                <div className="circle"></div>
                <div className="circle" id="right"></div>
                <div className="circle" id="bottom"></div>
              </div>

              <div className="front-content">
                <small className="badge">Vote</small>
                <div className="description">
                  <div className="title">
                    <p className="title">
                      <strong>{value}</strong>
                    </p>
                  </div>
                  <p className="point-description">{voteDescriptions[value]}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

export default Card;
