import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import TextareaAutosize from 'react-textarea-autosize';
import Send from 'assets/send_button';
import Mic from 'assets/mic_button';
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
  startVoiceInput,
  stopVoiceInput
}) => {
  const [keyboardInputValue, setKeyboardInputValue] = useState('');
  const [inputValue, setInputValue] = useState('');
  const formRef = useRef('');
  function handleChange(e) {
    setKeyboardInputValue(e.target.value);
    setInputValue(e.target.value);
  }

  function handleSubmit(e) {
    sendMessage(e);
    setInputValue('');
    setKeyboardInputValue('');
  }

  useEffect(() => {
    if (voiceInputPartialRecognizedText) {
      setInputValue(`${keyboardInputValue} ${voiceInputPartialRecognizedText}`);
    }
  }, [voiceInputPartialRecognizedText]);

  useEffect(() => {
    if (voiceInputRecognizedText) {
      const finalInput = `${keyboardInputValue} ${voiceInputRecognizedText}`;
      setInputValue(finalInput);
      setKeyboardInputValue(finalInput);
    }
  }, [voiceInputRecognizedText]);


  function onEnterPress(e) {
    if (e.keyCode === 13 && e.shiftKey === false) {
      e.preventDefault();
      // by dispatching the event we trigger onSubmit
      // formRef.current.submit() would not trigger onSubmit
      formRef.current.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  }

  const handleVoiceInputButtonClick = () => {
    if (!voiceInputEnabled || !voiceInputAvailable) {
      return;
    }
    if (voiceInputActive) {
      stopVoiceInput();
    } else {
      startVoiceInput();
    }
  };

  const renderVoiceInputButton = () => (
    <button
      type="button"
      className="rw-voice-input"
      disabled={!voiceInputAvailable}
      onClick={handleVoiceInputButtonClick}
    >
      <Mic active={voiceInputActive} available={voiceInputAvailable} alt="voiceInput" />
    </button>
  );

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
        value={inputValue}
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
  voiceInputPartialRecognizedText: state.voiceInput.get('partialRecognizedText')
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
  startVoiceInput: PropTypes.func,
  stopVoiceInput: PropTypes.func
};

export default connect(mapStateToProps)(Sender);
