import React, { useEffect } from 'react';
import { Message } from '../../store/threadsSlice';
import { ref, set } from 'firebase/database';
import { realtimeDb } from '../../config/firebase';

interface MessageListProps {
  messages: Message[];
  threadId: string;
}

const MessageList: React.FC<MessageListProps> = ({ messages, threadId }) => {
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      const readRef = ref(realtimeDb, `threads/${threadId}/read`);
      set(readRef, lastMessage.id);
    }
  }, [messages, threadId]);

  return (
    <div className="message-list">
      {messages.map((message, index) => (
        <div key={index} className={`message ${message.role}`}>
          <strong>{message.role}:</strong> {message.content}
        </div>
      ))}
    </div>
  );
};

export default MessageList;
