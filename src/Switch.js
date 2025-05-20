import React from "react";
import './Switch.css';

const Switch = ({ isChecked, onChange }) => {
    return (
        <div className="checkbox-wrapper-5">
            <div className="check">
                <input
                    checked={isChecked}
                    id="check-5"
                    type="checkbox"
                    onChange={onChange}
                />
                <label htmlFor="check-5" />
            </div>
        </div>
    );
};

export default Switch;
