import React from 'react';

const ThemeContext = React.createContext({
  mainColor: '',
  conversationBackgroundColor: '',
  userTextColor: '',
  userBackgroundColor: '',
  assistTextColor: '',
  assistBackgoundColor: '',
  rectangularWidget: false,
  presistQuickReplies: false
});

export default ThemeContext;
