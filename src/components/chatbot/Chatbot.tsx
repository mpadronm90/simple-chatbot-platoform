"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import AuthComponent from '../auth/AuthComponent';
import {
  fetchAndSetThreads, 
  addMessageToThread, 
  runAssistantWithStream,
  updateThreadMessages,
  setCurrentThread,
  setThreads
} from '../../store/threadsSlice';
import { ref, onValue, off } from 'firebase/database';
import { realtimeDb } from '../../services/firebase';
import { Cross2Icon, PaperPlaneIcon, ChatBubbleIcon } from '@radix-ui/react-icons';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchSelectedChatbot } from '../../store/selectedChatbotSlice';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatbotProps {
  chatbotId: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ chatbotId, isOpen, setIsOpen }) => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const currentThread = useSelector((state: RootState) => state.threads.currentThread);
  const { chatbot, status: chatbotStatus } = useSelector((state: RootState) => state.selectedChatbot);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [messageCount, setMessageCount] = useState(0);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    if (currentThread?.messages) {
      const newMessageCount = Object.keys(currentThread.messages).length;
      if (newMessageCount > messageCount) {
        scrollToBottom();
      }
      setMessageCount(newMessageCount);
    }
  }, [currentThread?.messages, messageCount]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen]);

  useEffect(() => {
    dispatch(fetchSelectedChatbot(chatbotId));
  }, [dispatch, chatbotId]);

  useEffect(() => {
    if (!currentThread && user && chatbotId) {
      dispatch(fetchAndSetThreads({ userId: user.uid, chatbotId }));
    }
  }, [dispatch, currentThread, user, chatbotId]);

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
  }, [dispatch, currentThread, user]);

  useEffect(() => {
    return () => {
      dispatch(setCurrentThread(null));
      dispatch(setThreads([]));
    };
  }, [dispatch]);

  useEffect(() => {
    const sendSizeToParent = () => {
      if (window.parent !== window) {
        const width = isOpen ? 384 : 64; // 384px is equivalent to max-w-md
        const height = isOpen ? 700 : 64;
        const borderRadius = isOpen ? '16px' : '50%';
        
        window.parent.postMessage({
          type: 'CHATBOT_RESIZE',
          isOpen,
          width: `${width}px`,
          height: `${height}px`,
          borderRadius,
        }, '*');
      }
    };

    sendSizeToParent();
    window.addEventListener('resize', sendSizeToParent);
    return () => window.removeEventListener('resize', sendSizeToParent);
  }, [isOpen]);

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

      if (!user) {
        throw new Error('User is not authenticated');
      }

      await dispatch(runAssistantWithStream({
        threadId: threadToUse?.id || '',
        assistantId: chatbot.agentId,
        userId: user.uid
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
          <div 
            className={`mx-2 p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
            style={message.role === 'assistant' ? chatbotStyles : {}}
          >
            <ReactMarkdown 
              className="markdown-content"
              components={{
                code({inline, className, children, ...props}: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={tomorrow as any}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    ));
  };

  const renderChatContent = () => {
    if (!isAuthenticated) {
      return (
        <div className="relative h-full flex items-center justify-center">
          <AuthComponent chatbotId={chatbotId} />
        </div>
      );
    }
    return renderChatInterface();
  };

  const renderChatInterface = () => (
    <>
      <CardHeader className="flex flex-row items-center justify-between" style={chatbotStyles}>
        <CardTitle className="text-2xl font-bold">
          {chatbotStatus === 'loading' ? 'Loading...' : chatbot ? chatbot.name : 'Chatbot'}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-500 hover:text-gray-700"
          onClick={() => setIsOpen(false)}
        >
          <Cross2Icon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
          {renderMessages()}
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          handleSendMessage(input); 
          setInput(''); 
          // Scroll to bottom immediately after sending
          scrollToBottom();
        }} className="flex w-full space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-grow"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            <PaperPlaneIcon className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </>
  );

  return (
    <div id="chatbot-container" className={`${isOpen ? 'w-96 h-[700px]' : 'w-16 h-16'} transition-all duration-300 ease-in-out`}>
      {isOpen ? (
        <Card className="w-full h-full flex flex-col overflow-hidden" style={{...chatbotStyles, borderRadius: '1rem'}}>
          {renderChatContent()}
        </Card>
      ) : (
        <Button
          id="chatbot-button"
          className="w-full h-full bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 flex items-center justify-center"
          onClick={() => setIsOpen(true)}
        >
          <span className="sr-only">Open Chat</span>
          <ChatBubbleIcon className="w-8 h-8" />
        </Button>
      )}
    </div>
  );
};

export default Chatbot;
