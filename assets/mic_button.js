import PropTypes from 'prop-types';
import React, { useContext } from 'react';
import ThemeContext from '../src/components/Widget/ThemeContext';

function voiceInputButton({ active, available }) {
  const { mainColor } = useContext(ThemeContext);

  const micSvg = (
    <g>
      <path d="M12,14c1.66,0,3-1.34,3-3V5c0-1.66-1.34-3-3-3S9,3.34,9,5v6C9,12.66,10.34,14,12,14z" />
      <path d="M17,11c0,2.76-2.24,5-5,5s-5-2.24-5-5H5c0,3.53,2.61,6.43,6,6.92V21h2v-3.08c3.39-0.49,6-3.39,6-6.92H17z" />
    </g>
  );

  const stopSvg = (
    <g>
      <path d="M0 0h24v24H0V0z" fill="none" />
      <path d="M16 8v8H8V8h8m2-2H6v12h12V6z" />
    </g>
  );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      enableBackground="new 0 0 24 24"
      height="24px"
      viewBox="0 0 24 24"
      width="24px"
      style={{ fill: mainColor }}
      className={available ? "rw-voice-input-icon" : "rw-voice-input-icon-disabled"}
    >
      {active ? stopSvg : micSvg}
    </svg>
  );
}

voiceInputButton.propTypes = {
  active: PropTypes.bool,
  available: PropTypes.bool,
};

export default voiceInputButton;
