// Chat.tsx
import React, {useEffect, useRef, useState} from 'react';
import {Box, TextField, List, ListItem, ListItemText, CircularProgress, IconButton, Button} from '@mui/material';
import { Delete } from '@mui/icons-material';

interface ChatMessage {
  role: 'user' | 'model';
  parts: string;
}

const loadChatMessages = (): ChatMessage[] => {
  // Load messages from localStorage on initial render
  const storedMessages = localStorage.getItem('chatMessages');
  if (storedMessages) {
    return JSON.parse(storedMessages);
  }
  return [];
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(loadChatMessages());
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Save messages to localStorage whenever they change
    localStorage.setItem('chatMessages', JSON.stringify(messages));
    ref.current?.scrollIntoView();
  }, [messages]);

  const handleClearHistory = () => {
    setMessages([]);
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!prompt) return;

    const newMessage: ChatMessage = { role: 'user', parts: prompt };
    const newMessages = [...messages, newMessage];
    setMessages(newMessages);
    setPrompt('');
    setLoading(true);

    try {
      const response = await fetch('/api/gemini/chat',{
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          history: messages,
          prompt: prompt,
        })});
      console.log(response.body);
      if (!response.body) {
        console.log('error');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      const chunks: string[] = [];

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          chunks.push(chunk);
          setMessages([...newMessages, { role: 'model', parts: chunks.join('') }]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(messages);
    } finally {
      setLoading(false); // Stop loading
    }
  };

  return (
    <Box display="flex" justifyContent="center" height="100vh">
      <Box display="flex" flexDirection="column" width="100%" maxWidth="1000px">
        <Box flexGrow={1} overflow="auto">
          <List>
            {messages.map((message, index) => (
              <ListItem key={index}>
                <ListItemText primary={message.parts} primaryTypographyProps={{style: {whiteSpace: "pre-wrap"}}}
                              secondary={message.role === 'user' ? 'Вы' : 'GPT'}/>
              </ListItem>
            ))}
            <div ref={ref}/>
          </List>
        </Box>
        <Box display="flex" marginBottom="20px" justifyContent="center" alignItems="center">
          {loading && <CircularProgress size={25} />}
          {/*<CircularProgress size={25} />*/}
        </Box>
        <Box display="flex" alignItems="center">
          <TextField
            fullWidth
            multiline
            placeholder="Введите сообщение..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown} // Use onKeyDown instead of onKeyPress
            disabled={loading}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSendMessage}
            disabled={loading}
          >
            Отправить
          </Button>
          <IconButton onClick={handleClearHistory}>
            <Delete/>
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default Chat;