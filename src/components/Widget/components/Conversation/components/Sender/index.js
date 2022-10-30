import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import TextareaAutosize from 'react-textarea-autosize';
import Send from 'assets/send_button';
import Mic from 'assets/mic_button';
import '../../../../../../';
import { stopVoiceInput, startVoiceInput } from '../../../../../../store/actions';
import './style.scss';

const Sender = ({
  sendMessage,
  inputTextFieldHint,
  disabledInput,
  userInput,
  voiceInputEnabled,
  voiceInputAvailable,
  voiceInputActive,
  voiceInputRecognizedText,
  voiceInputPartialRecognizedText,
  dispatch,
}) => {
  const [inputValue, setInputValue] = useState('');
  const formRef = useRef('');
  function handleChange(e) {
    setInputValue(e.target.value);
  }

  function handleSubmit(e) {
    sendMessage(e);
    setInputValue('');
  }

  function onEnterPress(e) {
    if (e.keyCode === 13 && e.shiftKey === false) {
      e.preventDefault();
      // by dispatching the event we trigger onSubmit
      // formRef.current.submit() would not trigger onSubmit
      formRef.current.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  }

  const renderVoiceInputButton = () => {
    return (
      <button
        className="rw-voice-input"
        disabled={!voiceInputAvailable}
        onClick={handleVoiceInputButtonClick}
      >
        <Mic active={voiceInputActive} available={voiceInputAvailable} alt="voiceInput" />
      </button>
    );
  };

  const handleVoiceInputButtonClick = e => {
    if (!voiceInputEnabled || !voiceInputAvailable) {
      return;
    }
    if (voiceInputActive) {
      dispatch(stopVoiceInput());
    } else {
      dispatch(startVoiceInput());
    }
  };

  return userInput === 'hide' ? (
    <div />
  ) : (
    <form ref={formRef} className="rw-sender" onSubmit={handleSubmit}>
      {voiceInputEnabled ? renderVoiceInputButton() : <></>}
      <TextareaAutosize
        type="text"
        minRows={1}
        onKeyDown={onEnterPress}
        maxRows={3}
        onChange={handleChange}
        className="rw-new-message"
        name="message"
        placeholder={inputTextFieldHint}
        disabled={disabledInput || userInput === 'disable'}
        autoFocus
        autoComplete="off"
        readOnly={voiceInputActive}
      />
      <button type="submit" className="rw-send" disabled={!(inputValue && inputValue.length > 0)}>
        <Send className="rw-send-icon" ready={!!(inputValue && inputValue.length > 0)} alt="send" />
      </button>
    </form>
  );
};
const mapStateToProps = state => ({
  userInput: state.metadata.get('userInput'),
  voiceInputEnabled: state.voiceInput.get('enabled'),
  voiceInputAvailable: state.voiceInput.get('available'),
  voiceInputActive: state.voiceInput.get('active'),
  voiceInputRecognizedText: state.voiceInput.get('recognizedText'),
  voiceInputPartialRecognizedText: state.voiceInput.get('partialRecognizedText'),
});

Sender.propTypes = {
  sendMessage: PropTypes.func,
  inputTextFieldHint: PropTypes.string,
  disabledInput: PropTypes.bool,
  userInput: PropTypes.string,
  voiceInputEnabled: PropTypes.bool,
  voiceInputAvailable: PropTypes.bool,
  voiceInputActive: PropTypes.bool,
  voiceInputRecognizedText: PropTypes.string,
  voiceInputPartialRecognizedText: PropTypes.string,
};

export default connect(mapStateToProps)(Sender);
