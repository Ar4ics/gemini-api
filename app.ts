// app.ts
import express, { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
app.use(express.json());

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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});