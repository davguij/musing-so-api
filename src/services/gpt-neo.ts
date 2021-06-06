import fetch from 'node-fetch';

const API_URL =
  'https://api-inference.huggingface.co/models/EleutherAI/gpt-neo-2.7B';

export async function completion(
  prompt: string,
  temperature: number
  // presence_penalty?: number,
  // frequency_penalty?: number
) {
  const req = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        return_full_text: false,
        max_new_tokens: 72,
        temperature,
        end_sequence: '###',
      },
      options: {
        use_cache: false,
      },
    }),
  });
  const resp = await req.json();
  return resp[0].generated_text as string;
}
