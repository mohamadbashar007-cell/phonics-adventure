import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from './lib/trpc';
import superjson from 'superjson';
import { Route, Switch } from 'wouter';
import { Toaster } from 'sonner';
import Home from './pages/Home';
import GroupView from './pages/GroupView';
import ProfilePage from './pages/Profile';
import CorrectAnswerCelebration from './components/CorrectAnswerCelebration';

function PreviewApp() {
  return (
    <div className="min-h-screen bg-background">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/group/:groupId" component={GroupView} />
        <Route path="/profile" component={ProfilePage} />
        <Route>404 Not Found</Route>
      </Switch>
      <Toaster position="top-center" />
      <CorrectAnswerCelebration />
    </div>
  );
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson as any,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <PreviewApp />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
