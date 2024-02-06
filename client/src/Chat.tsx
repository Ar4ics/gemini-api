// Chat.tsx
import React, {useRef, useState} from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import {ChatMessage} from "./ChatMessage";
import Messages from "./Messages";
import {useEffectOnce, useUpdateEffect} from "react-use";

type ChatModel = { url: string, model: string };

const options: { id: string, value: ChatModel, label: string }[] = [
  { id: '1', value: { url: '/api/chat', model: 'gpt-3.5-turbo-0125' }, label: 'ChatGPT 3.5' },
  { id: '2', value: { url: '/api/chat', model: 'gpt-4' }, label: 'ChatGPT 4' },
  { id: '3', value: { url: '/api/chat', model: 'deepseek-chat' }, label: 'DeepSeek Chat' },
  { id: '4', value: { url: '/api/chat', model: 'deepseek-coder' }, label: 'DeepSeek Coder' },
  { id: '5', value: { url: '/api/gemini', model: 'gemini-pro' }, label: 'Gemini' },
  { id: '6', value: { url: '/api/gemini/chat', model: 'gemini-pro' }, label: 'Gemini Chat' },
];

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<any>();
  const inputRef = useRef<any>();
  const [isCancelled, setIsCancelled] = useState(false);
  const [controller, setController] = useState<AbortController>();

  const label = 'GPT';
  const defaultModel = localStorage.getItem('model') ?? options[1].id;

  useEffectOnce(() => {
    scrollToBottom2('auto');
  });

  useUpdateEffect(() => {
    // Save messages to localStorage whenever they change
    localStorage.setItem('chatMessages', JSON.stringify(messages));
    //scrollToBottom();
    scrollToBottom2('smooth');
    //scrollToBottom3('smooth');
  }, [messages, loading]);

  // const scrollToBottom = () => {
  //   messagesEndRef.current?.scrollIntoView();
  // };

  const scrollToBottom2 = (behavior: ScrollBehavior) => {
    requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.scrollTo({top: ref.current.scrollHeight, behavior});
      }
    });
  }

  // const scrollToBottom3 = (behavior: ScrollBehavior) => {
  //   if (ref.current) {
  //     ref.current.scrollTo({top: ref.current.scrollHeight, behavior});
  //   }
  // }

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    setError('');
    setIsCancelled(false);
  };

  const handleDelete = () => {
    setMessages(messages.slice(0, -1));
    setError('');
    setIsCancelled(false);
  };

  const handleReplay = async (role: 'user' | 'model') => {
    const lastPromptIndex = role === 'user' ? -1 : -2;
    const lastPrompt = messages.at(lastPromptIndex)?.parts ?? '';

    const messagesExceptLast = messages.slice(0, lastPromptIndex);
    await handleSendMessage1(lastPrompt, messagesExceptLast);
  };

  const handleSendMessage = async () => {
    await handleSendMessage1(inputRef.current.value, messages);
  }

  const handleSendMessage1 = async (prompt: string, messages: ChatMessage[]) => {
    if (!prompt) return;

    const model = options.find(item => item.id === modelRef.current.value)?.value!;
    const url = `${process.env.REACT_APP_CHAT_BASE_URL}${model.url}`;
    console.log('model', model);

    const newMessage: ChatMessage = { role: 'user', parts: prompt };
    const newMessages = [...messages, newMessage];
    setMessages(newMessages);
    inputRef.current.value = '';
    setError('');
    setLoading(true);
    setIsCancelled(false);
    let newController = new AbortController();
    setController(newController);

    try {
      const response = await fetch(url,{
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST',
        signal: newController.signal,
        body: JSON.stringify({
          model: model.model,
          history: messages,
          prompt: prompt,
        })});
      console.log(response);

      if (!response.ok) {
        setError(await response.text());
        return;
      }

      if (!response.body) {
        setError('body is empty');
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
    } catch (error: any) {
      console.error('Error sending message:', error);
      if (error.name === 'AbortError') {
        console.log('Request was cancelled');
        setIsCancelled(true);
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false); // Stop loading
    }
  };

  const handleCancel = () => {
    if(controller){
      controller.abort();
    }
    setIsCancelled(true);
  };

  return (
    <Box display="flex" justifyContent="center" height="100vh" style={{margin: '0 16px'}}>
      <Box display="flex" flexDirection="column" width="100%" maxWidth="1000px" style={{margin: '16px 0'}}>
        <FormControl style={{marginBottom: '16px'}}>
          <InputLabel>{label}</InputLabel>
          <Select defaultValue={defaultModel} inputRef={modelRef} label={label}
                  onChange={(e) => localStorage.setItem('model', e.target.value)}
          >
            {options.map((option, index) => (
              <MenuItem key={index} value={option.id}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box ref={ref} flexGrow={1} overflow="auto">
          <Messages messages={messages} loading={loading} handleReplay={handleReplay} handleDelete={handleDelete} />
          <div ref={messagesEndRef}/>
        </Box>
        <Box display="flex" justifyContent="center" alignItems="center" style={{margin: '0 0 16px 0'}}>
          {loading && <CircularProgress size={25}/>}
          {error && <Alert style={{maxHeight: '100px', maxWidth: '100%'}} severity="error">{error}</Alert>}
        </Box>
        <Box display="flex" alignItems="center">
          <TextField
            inputRef={(input) => {
              inputRef.current = input;
              input?.focus()
            }}
            fullWidth
            multiline
            placeholder="Введите сообщение..."
            onKeyDown={handleKeyDown} // Use onKeyDown instead of onKeyPress
            disabled={loading || isCancelled || (error !== '')}
          />
          <Box display="flex" flexDirection="row" alignItems="center">
            {!loading && !isCancelled && !error && (
              <IconButton color="primary" onClick={handleSendMessage}>
                <SendIcon />
              </IconButton>
            )}
            {loading && !isCancelled && !error && (
              <IconButton color="secondary" onClick={handleCancel}>
                <CancelIcon />
              </IconButton>
            )}
            {!loading && (
              <IconButton onClick={handleClearHistory}>
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Chat;