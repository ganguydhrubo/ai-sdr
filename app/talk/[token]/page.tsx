import { Metadata } from 'next';
import { resolvePublicTalkContext } from '@/lib/voice/resolver';
import TalkClientInterface from './talk-client';

export const metadata: Metadata = {
  title: 'Talk to our AI SDR | Apex Technologies',
  description: 'Direct browser-based AI voice consultation with Apex SDR.',
};

export default async function TalkPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const resolution = await resolvePublicTalkContext(token);

  if (!resolution.valid || !resolution.publicContext) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 text-center shadow-xl">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">Link Inactive or Expired</h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {resolution.error ||
              'This voice conversation link is no longer active. You can still reach out to our team directly.'}
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="mailto:outreach@apextech.in"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition-colors text-center"
            >
              Contact Sales Team
            </a>
            <a
              href="https://apextech.in"
              className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-sm transition-colors text-center"
            >
              Visit Apex Technologies
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6">
      <TalkClientInterface token={token} context={resolution.publicContext} />
    </div>
  );
}
