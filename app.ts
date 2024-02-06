// app.ts
import cors from 'cors';
import path from 'path';
import express, { Request, Response } from 'express';
import {ChatSession, GoogleGenerativeAI, InputContent} from '@google/generative-ai';
import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import OpenAI from "openai";

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 3000,
});

const deepSeek = new OpenAI({
  apiKey: process.env.DEEPSEEKAI_API_KEY,
  baseURL: process.env.DEEPSEEKAI_BASE_URL,
  timeout: 3000,
});

const neuroGpt = new OpenAI({
  apiKey: process.env.NEUROGPT_API_KEY,
  baseURL: process.env.NEUROGPT_BASE_URL,
  timeout: 3000,
});

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { model, prompt, history } = req.body;
    if (!(typeof model === 'string')) {
      return res.status(400).send('Missing model parameter in the body.');
    }

    if (!prompt) {
      return res.status(400).send('Missing prompt parameter in the body.');
    }

    if (model === 'gpt-4') {
      let error = null;

      console.log('prompt', prompt);
      const models = ['gpt-4-1106-preview'];
      for (const modelKey of models) {
        console.log('model', modelKey);
        try {
          await sendStream(history, modelKey, prompt, neuroGpt, res);
          console.log('ok');
          return;
        }
        catch (e: any) {
          error = e;
          console.log(e.message);
        }
      }

      throw error;
    }

    const ai = model.startsWith('deepseek') ? deepSeek : openai;

    // throw new Error("some error text");

    await sendStream(history, model, prompt, ai, res);
  } catch (error: any) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

const sendStream = async (history: any[], model: string, prompt: string, ai: OpenAI, res: Response) => {
  const messages = ((history ?? []) as InputContent[])
    .map(item => ({role: item.role === 'user' ? 'user' as const : 'assistant' as const, content: item.parts as string}))

  const stream = await ai.chat.completions.create({
    model: model,
    messages: [...messages, { role: 'user', content: prompt }],
    stream: true,
  });

  const content: string[] = [];
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    content.push(text);
    res.write(text);
  }

  if (content.join('').trim() === '') {
    throw new Error('Empty response');
  }

  res.end();
}

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

export default app;