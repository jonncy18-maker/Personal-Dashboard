import { findNextTutorCall } from '../../../lib/tutor-call';

export async function GET() {
  const { nextCall, configured, error } = await findNextTutorCall();
  if (error) {
    return Response.json(
      { nextCall: null, configured, error },
      { status: 502 }
    );
  }
  return Response.json({ nextCall, configured });
}
