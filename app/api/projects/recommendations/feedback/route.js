import {
  authorized,
  json,
  saveFeedback,
} from '../../../../../lib/project-recommendations';
export async function POST(request) {
  if (!authorized(request, process.env.PROJECT_WIDGET_TOKEN))
    return json({ error: 'unauthorized' }, 401);
  try {
    if (!request.body) return json({ error: 'Invalid feedback' }, 400);
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 1000) return json({ error: 'Invalid feedback' }, 400);
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel();
    }
    if (text.length > 1000) return json({ error: 'Invalid feedback' }, 400);
    if (!(await saveFeedback(JSON.parse(text))))
      return json(
        { error: 'Invalid feedback or outdated recommendation' },
        400
      );
    return json({ status: 'recorded' });
  } catch {
    return json({ error: 'Feedback unavailable' }, 400);
  }
}
