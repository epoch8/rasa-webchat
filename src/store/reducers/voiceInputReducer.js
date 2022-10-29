import * as actionTypes from '../actions/actionTypes';

export default function (sttControllerRef) {
  const initialState = Map({
    enabled: false,
    available: false,
    active: false,
    recognizedText: '',
    partialRecognizedText: '',
    stopOnSilence: false
  });
  return function reducer(state = initialState, action) {
    switch (action.type) {
      case actionTypes.START_VOICE_INPUT: {
        if (
          sttControllerRef.current &&
          state.get('enabled') &&
          state.get('available') &&
          !state.get('active')
        ) {
          sttControllerRef.current.start();
          return state.set('active', true); // ?
        }
        return state;
      }
      case actionTypes.STOP_VOICE_INPUT: {
        if (sttControllerRef.current && state.get('active')) {
          sttControllerRef.current.stop();
          return state.set('active', false); // ?
        }
        return state;
      }
      case actionTypes.SET_VOICE_INPUT_ACTIVE: {
        return state.set('active', action.active);
      }
      case actionTypes.SET_PARTIAL_RECOGNIZED_TEXT: {
        return state.set('partialRecognizedText', action.text);
      }
      case actionTypes.SET_RECOGNIZED_TEXT: {
        if (
          state.get('stopOnSilence') &&
          sttControllerRef.current &&
          sttControllerRef.current.isActive()
        ) {
          sttControllerRef.current.stop();
        }
        return state.set('recognizedText', action.text);
      }
      case actionTypes.SET_VOICE_INPUT_AVAILABLE: {
        return state.set('available', action.available);
      }
      case actionTypes.SET_VOICE_INPUT_ENABLED: {
        return state.set('enabled', action.enabled);
      }
      case actionTypes.SET_STOP_ON_SILENCE: {
        return state.set('stopOnSilence', action.stopOnSilence);
      }
      default: {
        return state;
      }
    }
  };
}
