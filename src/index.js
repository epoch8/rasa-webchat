import React, { forwardRef, useEffect, useRef } from 'react';

import PropTypes from 'prop-types';
import { Provider } from 'react-redux';

import Widget from './components/Widget';
import { initStore } from '../src/store/store';
import * as actions from './store/actions';
import socket from './socket';
import ThemeContext from '../src/components/Widget/ThemeContext';
import STTController from './stt/STTController';
import TTSController from './tts/TTSController';
// eslint-disable-next-line import/no-mutable-exports

const ConnectedWidget = forwardRef((props, ref) => {
  class Socket {
    constructor(url, customData, path, protocol, protocolOptions, onSocketEvent) {
      this.url = url;
      this.customData = customData;
      this.path = path;
      this.protocol = protocol;
      this.protocolOptions = protocolOptions;
      this.onSocketEvent = onSocketEvent;
      this.socket = null;
      this.onEvents = [];
      this.marker = Math.random();
    }

    isInitialized() {
      return this.socket !== null && this.socket.connected;
    }

    on(event, callback) {
      if (!this.socket) {
        this.onEvents.push({ event, callback });
      } else {
        this.socket.on(event, callback);
      }
    }

    emit(message, data) {
      if (this.socket) {
        this.socket.emit(message, data);
      }
    }

    close() {
      if (this.socket) {
        this.socket.close();
      }
    }

    createSocket() {
      this.socket = socket(
        this.url,
        this.customData,
        this.path,
        this.protocol,
        this.protocolOptions
      );
      // We set a function on session_confirm here so as to avoid any race condition
      // this will be called first and will set those parameters for everyone to use.
      this.socket.on('session_confirm', (sessionObject) => {
        this.sessionConfirmed = true;
        this.sessionId =
          sessionObject && sessionObject.session_id ? sessionObject.session_id : sessionObject;
      });
      this.onEvents.forEach((event) => {
        this.socket.on(event.event, event.callback);
      });

      this.onEvents = [];
      Object.keys(this.onSocketEvent).forEach((event) => {
        this.socket.on(event, this.onSocketEvent[event]);
      });
    }
  }

  const instanceSocket = useRef({});
  const store = useRef(null);
  const sttControllerRef = useRef(null);
  const ttsControllerRef = useRef(null);

  if (!instanceSocket.current.url && !(store && store.current && store.current.socketRef)) {
    instanceSocket.current = new Socket(
      props.socketUrl,
      props.customData,
      props.socketPath,
      props.protocol,
      props.protocolOptions,
      props.onSocketEvent
    );
  }

  if (!instanceSocket.current.url && store && store.current && store.current.socketRef) {
    instanceSocket.current = store.socket;
  }

  const storage = props.params.storage === 'session' ? sessionStorage : localStorage;

  if (!store || !store.current) {
    store.current = initStore(
      props.connectingText,
      instanceSocket.current,
      storage,
      props.docViewer,
      props.onWidgetEvent
    );
    store.current.socketRef = instanceSocket.current.marker;
    store.current.socket = instanceSocket.current;
  }

  useEffect(
    () => () => {
      if (sttControllerRef.current) {
        sttControllerRef.current.cleanup();
        sttControllerRef.current = null;
      }
      if (ttsControllerRef.current) {
        ttsControllerRef.current.cleanup();
        ttsControllerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    // console.log('[props.voiceInputEnabled]');
    if (!sttControllerRef.current && props.voiceInputEnabled) {
      sttControllerRef.current = new STTController(props.voiceInputConfig.serverUrl);
      sttControllerRef.current.onSttAvailableChange = (available) => {
        store.current.dispatch(actions.setVoiceInputAvailable(available));
      };
      sttControllerRef.current.onActiveChange = (active) => {
        store.current.dispatch(actions.setVoiceInputActive(active));
      };
      sttControllerRef.current.onRecognitionData = (text, final) => {
        if (final) {
          store.current.dispatch(actions.setRecognizedText(text));
          store.current.dispatch(actions.setPartialRecognizedText(''));
        } else {
          store.current.dispatch(actions.setPartialRecognizedText(text));
        }
      };
    } else if (sttControllerRef.current && !props.voiceInputEnabled) {
      sttControllerRef.current.cleanup();
      sttControllerRef.current = null;
    }
    store.current.dispatch(actions.setVoiceInputEnabled(props.voiceInputEnabled));
  }, [props.voiceInputEnabled]);

  useEffect(() => {
    // console.log('[props.voiceInputConfig.serverUrl, sttControllerRef.current]');
    if (sttControllerRef.current) {
      sttControllerRef.current.setSttUrl(props.voiceInputConfig.serverUrl);
    }
  }, [props.voiceInputConfig.serverUrl, sttControllerRef.current]);

  useEffect(() => {
    // console.log('[props.voiceInputConfig.audioChunkSize, sttControllerRef.current]');
    if (sttControllerRef.current && props.voiceInputConfig.audioChunkSize) {
      sttControllerRef.current.setAudioChunkSize(props.voiceInputConfig.audioChunkSize);
    }
  }, [props.voiceInputConfig.audioChunkSize, sttControllerRef.current]);

  useEffect(() => {
    if (sttControllerRef.current) {
      sttControllerRef.current.stopOnSilenceDuration = props.voiceInputConfig.stopOnSilenceDuration;
    }
  }, [props.voiceInputConfig.stopOnSilenceDuration, sttControllerRef.current]);

  useEffect(() => {
    if (sttControllerRef.current) {
      sttControllerRef.current.voiceInputStopOnSilence = props.voiceInputStopOnSilence;
    }
    store.current.dispatch(actions.setStopOnSilence(props.voiceInputStopOnSilence));
  }, [props.voiceInputStopOnSilence, sttControllerRef.current]);

  useEffect(() => {
    if (props.ttsEnabled && !ttsControllerRef.current) {
      ttsControllerRef.current = new TTSController();
    } else if (!props.ttsEnabled && ttsControllerRef.current) {
      ttsControllerRef.current.cleanup();
      ttsControllerRef.current = null;
    }
    if (ttsControllerRef.current) {
      ttsControllerRef.current.ttsServerUrl = props.ttsConfig.serverUrl;
    }
  }, [ttsControllerRef.current, props.ttsEnabled, props.ttsConfig.serverUrl]);

  const startVoiceInput = () => {
    if (
      sttControllerRef.current &&
      sttControllerRef.current.isSttAvalable() &&
      !sttControllerRef.current.isActive()
    ) {
      sttControllerRef.current.start();
    }
  };

  const stopVoiceInput = (immediatly = false) => {
    if (sttControllerRef.current && sttControllerRef.current.isActive()) {
      sttControllerRef.current.stop(immediatly);
    }
  };

  return (
    <Provider store={store.current}>
      <ThemeContext.Provider
        value={{
          mainColor: props.mainColor,
          conversationBackgroundColor: props.conversationBackgroundColor,
          userTextColor: props.userTextColor,
          userBackgroundColor: props.userBackgroundColor,
          assistTextColor: props.assistTextColor,
          assistBackgoundColor: props.assistBackgoundColor,
          rectangularWidget: props.rectangularWidget,
          presistQuickReplies: props.presistQuickReplies
        }}
      >
        <Widget
          ref={ref}
          initPayload={props.initPayload}
          title={props.title}
          subtitle={props.subtitle}
          customData={props.customData}
          handleNewUserMessage={props.handleNewUserMessage}
          profileAvatar={props.profileAvatar}
          showCloseButton={props.showCloseButton}
          showFullScreenButton={props.showFullScreenButton}
          hideWhenNotConnected={props.hideWhenNotConnected}
          connectOn={props.connectOn}
          autoClearCache={props.autoClearCache}
          fullScreenMode={props.fullScreenMode}
          badge={props.badge}
          embedded={props.embedded}
          params={props.params}
          storage={storage}
          inputTextFieldHint={props.inputTextFieldHint}
          openLauncherImage={props.openLauncherImage}
          closeImage={props.closeImage}
          customComponent={props.customComponent}
          displayUnreadCount={props.displayUnreadCount}
          socket={instanceSocket.current}
          showMessageDate={props.showMessageDate}
          customMessageDelay={props.customMessageDelay}
          tooltipPayload={props.tooltipPayload}
          tooltipDelay={props.tooltipDelay}
          disableTooltips={props.disableTooltips}
          defaultHighlightCss={props.defaultHighlightCss}
          defaultHighlightAnimation={props.defaultHighlightAnimation}
          defaultHighlightClassname={props.defaultHighlightClassname}
          openOnStart={props.openOnStart}
          ttsEnabled={props.ttsEnabled}
          ttsNewMessages={props.ttsNewMessages}
          startVoiceInput={startVoiceInput}
          stopVoiceInput={stopVoiceInput}
          ttsConfig={props.ttsConfig}
          ttsControllerRef={ttsControllerRef}
        />
      </ThemeContext.Provider>
    </Provider>
  );
});

ConnectedWidget.propTypes = {
  initPayload: PropTypes.string,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  protocol: PropTypes.string,
  socketUrl: PropTypes.string.isRequired,
  socketPath: PropTypes.string,
  protocolOptions: PropTypes.shape({}),
  customData: PropTypes.shape({}),
  handleNewUserMessage: PropTypes.func,
  profileAvatar: PropTypes.string,
  inputTextFieldHint: PropTypes.string,
  connectingText: PropTypes.string,
  showCloseButton: PropTypes.bool,
  showFullScreenButton: PropTypes.bool,
  hideWhenNotConnected: PropTypes.bool,
  connectOn: PropTypes.oneOf(['mount', 'open']),
  autoClearCache: PropTypes.bool,
  onSocketEvent: PropTypes.objectOf(PropTypes.func),
  fullScreenMode: PropTypes.bool,
  badge: PropTypes.number,
  embedded: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  params: PropTypes.object,
  openLauncherImage: PropTypes.string,
  closeImage: PropTypes.string,
  docViewer: PropTypes.bool,
  customComponent: PropTypes.func,
  displayUnreadCount: PropTypes.bool,
  showMessageDate: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
  customMessageDelay: PropTypes.func,
  tooltipPayload: PropTypes.string,
  tooltipDelay: PropTypes.number,
  onWidgetEvent: PropTypes.shape({
    onChatOpen: PropTypes.func,
    onChatClose: PropTypes.func,
    onChatVisible: PropTypes.func,
    onChatHidden: PropTypes.func
  }),
  disableTooltips: PropTypes.bool,
  defaultHighlightCss: PropTypes.string,
  defaultHighlightAnimation: PropTypes.string,
  mainColor: PropTypes.string,
  conversationBackgroundColor: PropTypes.string,
  userTextColor: PropTypes.string,
  userBackgroundColor: PropTypes.string,
  assistTextColor: PropTypes.string,
  assistBackgoundColor: PropTypes.string,
  rectangularWidget: PropTypes.bool,
  openOnStart: PropTypes.bool,
  presistQuickReplies: PropTypes.bool,
  voiceInputEnabled: PropTypes.bool,
  voiceInputConfig: PropTypes.shape({
    serverUrl: PropTypes.string,
    audioChunkSize: PropTypes.number,
    stopOnSilenceDuration: PropTypes.number
  }),
  voiceInputStopOnSilence: PropTypes.bool,
  ttsEnabled: PropTypes.bool,
  ttsNewMessages: PropTypes.bool,
  ttsConfig: PropTypes.shape({
    serverUrl: PropTypes.string
  })
};

ConnectedWidget.defaultProps = {
  title: 'Welcome',
  customData: {},
  inputTextFieldHint: 'Type a message...',
  connectingText: 'Waiting for server...',
  fullScreenMode: false,
  hideWhenNotConnected: true,
  autoClearCache: false,
  connectOn: 'mount',
  onSocketEvent: {},
  protocol: 'socketio',
  socketUrl: 'http://localhost',
  protocolOptions: {},
  badge: 0,
  embedded: false,
  params: {
    storage: 'local'
  },
  docViewer: false,
  showCloseButton: true,
  showFullScreenButton: false,
  displayUnreadCount: false,
  showMessageDate: false,
  customMessageDelay: (message) => {
    let delay = message.length * 30;
    if (delay > 3 * 1000) delay = 3 * 1000;
    if (delay < 800) delay = 800;
    return delay;
  },
  tooltipPayload: null,
  tooltipDelay: 500,
  onWidgetEvent: {
    onChatOpen: () => {},
    onChatClose: () => {},
    onChatVisible: () => {},
    onChatHidden: () => {}
  },
  disableTooltips: false,
  mainColor: '',
  conversationBackgroundColor: '',
  userTextColor: '',
  userBackgroundColor: '',
  assistTextColor: '',
  assistBackgoundColor: '',
  rectangularWidget: false,
  openOnStart: false,
  presistQuickReplies: true,
  voiceInputEnabled: false,
  voiceInputConfig: {
    serverUrl: 'ws://localhost:2700',
    audioChunkSize: 2048,
    stopOnSilenceDuration: 2000
  },
  voiceInputStopOnSilence: false,
  ttsEnabled: false,
  ttsNewMessages: false,
  ttsConfig: {
    serverUrl: 'ws://localhost:2700'
  }
};

export default ConnectedWidget;
