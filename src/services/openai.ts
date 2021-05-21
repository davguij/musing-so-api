import fetch from 'node-fetch';

export async function completion(
  prompt: string,
  temperature: number,
  presence_penalty: number,
  frequency_penalty: number
) {
  const req = await fetch(
    'https://api.openai.com/v1/engines/davinci/completions ',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        max_tokens: 72, // 280 characters as Twitter max + 8 more chars for leeway
        stop: '##',
        temperature,
        presence_penalty, // could also be a range
        frequency_penalty, // could be a range
      }),
    }
  );
  const resp = await req.json();

  return resp.choices as { text: string }[];
}
