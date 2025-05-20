import React from "react";
import "./BrokenTextButton.css";

const BrokenTextButton = ({ text }) => {
    return (
        <button className="ui-btn">
            <span>{text}</span>
        </button>
    );
};

export default BrokenTextButton;
