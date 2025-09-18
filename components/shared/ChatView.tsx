import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { User, Message } from '../../types';
import { PaperAirplaneIcon } from '../../constants';
import Button from './Button';
import { sendMessage, listenForMessages } from '../../services/firebaseService';

interface ChatViewProps {
  rideRequestId: string;
  recipient: User;
}

const ChatView: React.FC<ChatViewProps> = ({ rideRequestId, recipient }) => {
  const { state } = useAppContext();
  const { user } = state;
  const [text, setText] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = listenForMessages(rideRequestId, setChatMessages);
    return () => unsubscribe();
  }, [rideRequestId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && user?.id) {
      sendMessage(rideRequestId, user.id, text);
      setText('');
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg flex flex-col h-[60vh] max-h-[700px]">
      <div className="p-4 border-b border-slate-700 flex items-center space-x-3">
        <img src={recipient.avatarUrl} alt={recipient.name} className="w-10 h-10 rounded-full" />
        <div>
          <p className="font-bold">{recipient.name}</p>
          <p className="text-xs text-slate-400">{recipient.role}</p>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {chatMessages.map((msg) => {
          const isMe = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${isMe ? 'bg-sky-600 rounded-br-lg' : 'bg-slate-700 rounded-bl-lg'}`}>
                <p className="text-sm">{msg.text}</p>
                 {/* Timestamps are now server-generated; not converting them for simplicity */}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-slate-700">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message ${recipient.name}...`}
            className="w-full bg-slate-700 border border-slate-600 rounded-full px-4 py-2 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
          />
          <Button type="submit" className="!p-3 rounded-full">
            <PaperAirplaneIcon className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatView;