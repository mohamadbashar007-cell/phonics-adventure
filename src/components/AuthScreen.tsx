import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';

interface AuthScreenProps {
  onComplete?: (username: string, name: string, userId: number, age: number, allUnlocked: boolean) => void;
}

type AuthMode = 'login' | 'register' | 'verify-register' | 'forgot' | 'reset';

export default function AuthScreen({ onComplete }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const startRegisterMutation = trpc.startRegister.useMutation();
  const verifyRegisterMutation = trpc.verifyRegisterOtp.useMutation();
  const loginMutation = trpc.login.useMutation();
  const requestPasswordResetMutation = trpc.requestPasswordReset.useMutation();
  const resetPasswordMutation = trpc.resetPasswordWithOtp.useMutation();

  const loading =
    startRegisterMutation.isPending ||
    verifyRegisterMutation.isPending ||
    loginMutation.isPending ||
    requestPasswordResetMutation.isPending ||
    resetPasswordMutation.isPending;

  const resetStatus = () => {
    setError('');
    setMessage('');
  };

  const completeLogin = (result: any) => {
    onComplete?.(result.username || email, result.name, result.userId, result.age, result.allUnlocked || false);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    resetStatus();
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      completeLogin(result);
    } catch (err: any) {
      const text = err.message || 'Login failed';
      setError(text);
      if (text.toLowerCase().includes('not verified')) {
        setMode('verify-register');
      }
    }
  };

  const handleStartRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    resetStatus();
    try {
      const result = await startRegisterMutation.mutateAsync({
        email,
        password,
        name,
        age: Number(age),
      });
      setMessage(result.message || 'Verification code sent.');
      setCode('');
      setMode('verify-register');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  };

  const handleVerifyRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    resetStatus();
    try {
      const result = await verifyRegisterMutation.mutateAsync({ email, code });
      completeLogin(result);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    }
  };

  const handleForgot = async (event: React.FormEvent) => {
    event.preventDefault();
    resetStatus();
    try {
      const result = await requestPasswordResetMutation.mutateAsync({ email });
      setMessage(result.message || 'If the email exists, a reset code has been sent.');
      setCode('');
      setNewPassword('');
      setMode('reset');
    } catch (err: any) {
      setError(err.message || 'Could not send reset code');
    }
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    resetStatus();
    try {
      const result = await resetPasswordMutation.mutateAsync({ email, code, password: newPassword });
      setMessage(result.message || 'Password updated. You can login now.');
      setPassword('');
      setNewPassword('');
      setCode('');
      setMode('login');
    } catch (err: any) {
      setError(err.message || 'Password reset failed');
    }
  };

  const title =
    mode === 'register'
      ? 'Create Account'
      : mode === 'verify-register'
      ? 'Verify Email'
      : mode === 'forgot'
      ? 'Reset Password'
      : mode === 'reset'
      ? 'Enter Reset Code'
      : 'Login';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-black text-center mb-2 text-blue-600">Phonics Adventure</h1>
        <p className="text-center text-gray-600 mb-8">{title}</p>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <EmailInput email={email} setEmail={setEmail} />
            <PasswordInput label="Password" value={password} setValue={setPassword} />
            <SubmitButton loading={loading} label="Login" />
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleStartRegister} className="space-y-4">
            <EmailInput email={email} setEmail={setEmail} />
            <TextInput label="Your Name" value={name} setValue={setName} required />
            <TextInput label="Your Age" value={age} setValue={setAge} type="number" required />
            <PasswordInput label="Password" value={password} setValue={setPassword} />
            <SubmitButton loading={loading} label="Send Verification Code" />
          </form>
        )}

        {mode === 'verify-register' && (
          <form onSubmit={handleVerifyRegister} className="space-y-4">
            <EmailInput email={email} setEmail={setEmail} />
            <TextInput label="Verification Code" value={code} setValue={setCode} inputMode="numeric" maxLength={6} required />
            <SubmitButton loading={loading} label="Verify and Login" />
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <EmailInput email={email} setEmail={setEmail} />
            <SubmitButton loading={loading} label="Send Reset Code" />
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleReset} className="space-y-4">
            <EmailInput email={email} setEmail={setEmail} />
            <TextInput label="Reset Code" value={code} setValue={setCode} inputMode="numeric" maxLength={6} required />
            <PasswordInput label="New Password" value={newPassword} setValue={setNewPassword} />
            <SubmitButton loading={loading} label="Update Password" />
          </form>
        )}

        {error && <div className="mt-4 bg-red-100 text-red-700 p-3 rounded-lg text-sm font-bold">{error}</div>}
        {message && <div className="mt-4 bg-green-100 text-green-700 p-3 rounded-lg text-sm font-bold">{message}</div>}

        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          {mode !== 'login' && (
            <button type="button" onClick={() => { resetStatus(); setMode('login'); }} className="text-blue-600 font-bold hover:text-blue-700">
              Back to Login
            </button>
          )}
          {mode === 'login' && (
            <>
              <button type="button" onClick={() => { resetStatus(); setMode('register'); }} className="text-blue-600 font-bold hover:text-blue-700">
                Create Account
              </button>
              <button type="button" onClick={() => { resetStatus(); setMode('forgot'); }} className="text-gray-600 font-bold hover:text-gray-800">
                Forgot password?
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailInput({ email, setEmail }: { email: string; setEmail: (value: string) => void }) {
  return <TextInput label="Email" value={email} setValue={setEmail} type="email" autoComplete="email" required />;
}

function PasswordInput({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) {
  return <TextInput label={label} value={value} setValue={setValue} type="password" autoComplete="current-password" required />;
}

function TextInput({
  label,
  value,
  setValue,
  type = 'text',
  required,
  autoComplete,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
      />
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? '...' : label}
    </button>
  );
}
