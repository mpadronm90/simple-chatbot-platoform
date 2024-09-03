"use client"; // Add this line at the top

import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import {
  fetchAndSetThreads, 
  addMessageToThread, 
  runAssistantWithStream,
  updateThreadMessages,
  setCurrentThread,
  setThreads
} from '../../store/threadsSlice';
import { ref, onValue, off } from 'firebase/database';
import { realtimeDb } from '../../services/firebase'; // Adjust this import based on your Firebase setup
import { Send } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchSelectedChatbot } from '../../store/selectedChatbotSlice';

interface ChatbotProps {
  chatbotId: string;
  userId: string;
  adminId: string;
}

const Chatbot: React.FC<ChatbotProps> = ({ chatbotId, userId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const currentThread = useSelector((state: RootState) => state.threads.currentThread);
  const { chatbot, status: chatbotStatus } = useSelector((state: RootState) => state.selectedChatbot);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    if(!chatbot) {
      dispatch(fetchSelectedChatbot(chatbotId));
    }
    if (!currentThread && userId && chatbotId) {
      dispatch(fetchAndSetThreads({ userId, chatbotId }));
    }

  }, [dispatch, currentThread, userId, chatbotId, chatbot]);

  useEffect(() => {
    if (currentThread) {
      const threadRef = ref(realtimeDb, `threads/${currentThread.id}`);
      
      const onDataChange = (snapshot: any) => {
        if (snapshot.exists()) {
          const threadData = snapshot.val();
          dispatch(updateThreadMessages({
            threadId: threadData.id,
            messages: threadData.messages
          }));
        }
      };

      onValue(threadRef, onDataChange);

      return () => {
        // Clean up the listener when the component unmounts
        off(threadRef, 'value', onDataChange);
      };
    
    }
  }, [dispatch, currentThread, userId]);

  useEffect(() => {
    return () => {
      dispatch(setCurrentThread(null));
      dispatch(setThreads([]));
    };
  }, [dispatch]);

  const handleSendMessage = async (content: string) => {
    setIsLoading(true);
    try {
      let threadToUse = currentThread;

      await dispatch(addMessageToThread({
        threadId: threadToUse?.id || '',
        content: content
      }));

      if (!chatbot || !chatbot.agentId) {
        throw new Error('No valid assistant ID available');
      }

      await dispatch(runAssistantWithStream({
        threadId: threadToUse?.id || '',
        assistantId: chatbot.agentId,
        userId: userId
      }));
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const chatbotStyles = chatbot?.appearance || {};

  const renderMessages = () => {
    if (!currentThread || !currentThread.messages) return null;

    return Object.entries(currentThread.messages).map(([messageId, message]) => (
      <div key={messageId} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`flex items-start ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
          <Avatar className="w-8 h-8">
            <AvatarFallback>{message.role === 'user' ? 'U' : 'B'}</AvatarFallback>
            <AvatarImage src={message.role === 'user' ? "/user-avatar.png" : "/bot-avatar.png"} />
          </Avatar>
          <div className={`mx-2 p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
            {message.content}
          </div>
        </div>
      </div>
    ));
  };

  return (
    <Card className="w-full max-w-md mx-auto h-[600px] flex flex-col" style={chatbotStyles}>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          {chatbotStatus === 'loading' ? 'Loading...' : chatbot ? chatbot.name : 'Chatbot'}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-4">
          {renderMessages()}
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); setInput(''); }} className="flex w-full space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-grow"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default Chatbot;
