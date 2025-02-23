import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ImmutablePropTypes from 'react-immutable-proptypes';
import { connect } from 'react-redux';

import { MESSAGES_TYPES } from 'constants';
import { Video, Image, Message, Carousel, Buttons } from 'messagesComponents';

import PlayButton from 'assets/play_button';
import './styles.scss';
import ThemeContext from '../../../../ThemeContext';

const isToday = (date) => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

const formatDate = (date) => {
  const dateToFormat = new Date(date);
  const showDate = isToday(dateToFormat) ? '' : `${dateToFormat.toLocaleDateString()} `;
  return `${showDate}${dateToFormat.toLocaleTimeString('en-US', { timeStyle: 'short' })}`;
};

const scrollToBottom = () => {
  const messagesDiv = document.getElementById('rw-messages');
  if (messagesDiv) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
};

class Messages extends Component {
  constructor(props) {
    super(props);
    this.state = { ttsMsgId: null };
  }

  componentDidMount() {
    scrollToBottom();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.messages !== this.props.messages) {
      scrollToBottom();
    }
  }

  getComponentToRender = (message, index, isLast) => {
    const { params } = this.props;
    const ComponentToRender = (() => {
      switch (message.get('type')) {
        case MESSAGES_TYPES.TEXT: {
          return Message;
        }
        case MESSAGES_TYPES.CAROUSEL: {
          return Carousel;
        }
        case MESSAGES_TYPES.VIDREPLY.VIDEO: {
          return Video;
        }
        case MESSAGES_TYPES.IMGREPLY.IMAGE: {
          return Image;
        }
        case MESSAGES_TYPES.BUTTONS: {
          return Buttons;
        }
        case MESSAGES_TYPES.CUSTOM_COMPONENT:
          return connect(
            store => ({ store }),
            dispatch => ({ dispatch })
          )(this.props.customComponent);
        default:
          return null;
      }
    })();
    if (message.get('type') === 'component') {
      const messageProps = message.get('props');
      return (<ComponentToRender
        id={index}
        {...(messageProps.toJS ? messageProps.toJS() : messageProps)}
        isLast={isLast}
      />);
    }
    return <ComponentToRender id={index} params={params} message={message} isLast={isLast} />;
  }

  render() {
    const {
      displayTypingIndication,
      profileAvatar,
      ttsEnabled,
      ttsConfig,
      ttsControllerRef
    } = this.props;

    const renderMessages = () => {
      const {
        messages,
        showMessageDate
      } = this.props;

      if (messages.isEmpty()) return null;

      const groups = [];
      let group = null;

      const dateRenderer = typeof showMessageDate === 'function' ? showMessageDate :
        showMessageDate === true ? formatDate : null;

      const renderMessageDate = (message) => {
        const timestamp = message.get('timestamp');

        if (!dateRenderer || !timestamp) return null;
        const dateToRender = dateRenderer(message.get('timestamp', message));
        return dateToRender
          ? <span className="rw-message-date">{dateRenderer(message.get('timestamp'), message)}</span>
          : null;
      };

      const onPlayButtonClick = (message, index) => {
        if (!ttsControllerRef.current) {
          if (this.state.ttsMsgId !== null) {
            this.setState({ ttsMsgId: null });
          }
          return;
        }
        if (index === this.state.ttsMsgId) {
          this.setState({ ttsMsgId: null });
          ttsControllerRef.current.cleanup();
        } else {
          const textParts = [];
          const text = message.get('text');
          if (text) {
            textParts.push(text);
          }
          const buttons = message.get('quick_replies');
          if (buttons) {
            textParts.push(...buttons.map(reply => reply.get('title')));
          }
          const ttsText = textParts.join('.\n');
          if (!ttsText) {
            return;
          }
          this.setState({ ttsMsgId: index });
          ttsControllerRef.current.cleanup();
          ttsControllerRef.current.enqueue(
            ttsText,
            ttsConfig,
            () => { this.setState({ ttsMsgId: null }); }
          );
        }
      };

      const renderMessage = (message, index) => {
        const msgType = message.get('type');
        const isText = msgType === MESSAGES_TYPES.TEXT || msgType === MESSAGES_TYPES.BUTTONS;
        return (
          <div className={`rw-message ${profileAvatar ? 'rw-with-avatar' : ''}`} key={index}>
            {
              profileAvatar &&
              message.get('showAvatar') &&
              <img src={profileAvatar} className="rw-avatar" alt="profile" />
            }
            <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              {this.getComponentToRender(message, index, index === messages.size - 1)}
              {ttsEnabled && isText &&
              <PlayButton
                active={this.state.ttsMsgId === index}
                onClick={() => onPlayButtonClick(message, index)}
              />}
            </div>
            {renderMessageDate(message)}
          </div>
        );
      };

      messages.forEach((msg, index) => {
        if (msg.get('hidden')) return;
        if (group === null || group.from !== msg.get('sender')) {
          if (group !== null) groups.push(group);

          group = {
            from: msg.get('sender'),
            messages: []
          };
        }

        group.messages.push(renderMessage(msg, index));
      });

      groups.push(group); // finally push last group of messages.

      return groups.map((g, index) => (
        <div className={`rw-group-message rw-from-${g && g.from}`} key={`group_${index}`}>
          {g.messages}
        </div>
      ));
    };
    const { conversationBackgroundColor, assistBackgoundColor } = this.context;

    return (
      <div id="rw-messages" style={{ backgroundColor: conversationBackgroundColor }} className="rw-messages-container">
        { renderMessages() }
        {displayTypingIndication && (
          <div className={`rw-message rw-typing-indication ${profileAvatar && 'rw-with-avatar'}`}>
            {
              profileAvatar &&
              <img src={profileAvatar} className="rw-avatar" alt="profile" />
            }
            <div style={{ backgroundColor: assistBackgoundColor }}className="rw-response">
              <div id="wave">
                <span className="rw-dot" />
                <span className="rw-dot" />
                <span className="rw-dot" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}
Messages.contextType = ThemeContext;
Messages.propTypes = {
  messages: ImmutablePropTypes.listOf(ImmutablePropTypes.map),
  profileAvatar: PropTypes.string,
  customComponent: PropTypes.func,
  showMessageDate: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
  displayTypingIndication: PropTypes.bool,
  ttsEnabled: PropTypes.bool,
  ttsConfig: PropTypes.shape({}),
  ttsControllerRef: PropTypes.shape({})
};

Message.defaultTypes = {
  displayTypingIndication: false
};

export default connect(store => ({
  messages: store.messages,
  displayTypingIndication: store.behavior.get('messageDelayed')
}))(Messages);
