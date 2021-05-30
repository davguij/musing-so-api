import fetch from 'node-fetch';

export async function completion(
  prompt: string,
  temperature: number,
  presence_penalty: number,
  frequency_penalty: number
) {
  const req = await fetch(
    'https://api.openai.com/v1/engines/davinci/completions',
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

export async function isContentProfane(content: string) {
  const toxicThreshold = -0.355;

  const req = await fetch(
    'https://api.openai.com/v1/engines/content-filter-alpha-c4/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: content,
        max_tokens: 1,
        temperature: 0,
        top_p: 1,
        presence_penalty: 0,
        frequency_penalty: 0,
        logprobs: 10,
      }),
    }
  );
  const resp = await req.json();

  let filterResult = resp.choices[0].text as string;

  if (['0', '1', '2'].includes(filterResult) === false) {
    return true;
  }

  if (filterResult === '2') {
    // If the model returns "2", return its confidence in 2 or other output-labels
    const logprobs = resp.choices[0].logprobs.top_logprobs[0];
    // Guaranteed to have a confidence for 2 since this was the selected token.
    // If the model is not sufficiently confident in "2"...
    if (logprobs['2'] < toxicThreshold) {
      // ... check if there are probabilities for '0' or '1'
      if (
        typeof logprobs['0'] === 'undefined' &&
        typeof logprobs['1'] === 'undefined'
      ) {
        // If neither "0" or "1" are available, return true
        return true;
      }
      return false;
    }
    return true;
  }

  return false;
}
