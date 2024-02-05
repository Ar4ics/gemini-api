// app.ts
import cors from 'cors';
import path from 'path';
import express, { Request, Response } from 'express';
import {ChatSession, GoogleGenerativeAI} from '@google/generative-ai';
import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

// console.log(process.env);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY ?? '');
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];
const model = genAI.getGenerativeModel({ model: 'gemini-pro', safetySettings });

async function callGoogleGeminiApi(prompt: string) {
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

app.post('/api/gemini', async (req: Request, res: Response) => {
  try {
    // console.log(req.body);

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).send('Missing prompt parameter in the body.');
    }

    // Call the Google Gemini API
    const response = await callGoogleGeminiApi(prompt);
    res.send(response);
  } catch (error: any) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const { prompt, history } = req.body;
    if (!prompt) {
      return res.status(400).send('Missing prompt parameter in the body.');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const chat = model.startChat({ history })
    const result = await chat.sendMessageStream(prompt);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      const data = `${chunkText}`;
      res.write(data);
    }
    res.end();
  } catch (error: any) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

type Chat = { id: string, session: ChatSession };

let chats: Chat[] = [];

app.get('/api/gemini/chat/:chatId', async (req: Request, res: Response) => {
  const chatId = req.params.chatId;
  if (!chatId) {
    return res.status(400).send('Missing chatId header.');
  }

  const chat = chats.find(c => c.id === chatId);
  if (!chat) {
    return res.status(404).send(`Chat ${chatId} not found.`);
  }

  const history = await chat.session.getHistory();
  res.json(history);
});

app.post('/api/gemini/chat/:chatId', async (req: Request, res: Response) => {
  const chatId = req.params.chatId;
  if (!chatId) {
    return res.status(400).send('Missing chatId header.');
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).send('Missing prompt parameter in the body.');
  }

  let chat = chats.find(c => c.id === chatId);
  if (!chat) {
    chat = { id: chatId, session: model.startChat() };
    chats = [...chats, chat];
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const result = await chat.session.sendMessageStream(prompt);

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    const data = `data: ${chunkText}\n\n`;
    res.write(data);
  }

  res.end();
});

app.delete('/api/gemini/chat/:chatId', async (req: Request, res: Response) => {
  const chatId = req.params.chatId;
  if (!chatId) {
    return res.status(400).send('Missing chatId header.');
  }

  const chat = chats.find(c => c.id === chatId);
  if (!chat) {
    return res.status(404).send(`Chat ${chatId} not found.`);
  }

  chats = chats.filter(c => c.id !== chat.id);

  res.end();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build/index.html'));
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});