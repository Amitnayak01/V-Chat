import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, UserPlus, Upload, WifiOff, Server, AlertCircle, Clock } from 'lucide-react';
import AppLogo from '../../assets/logo.png';

const HEALTH_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/health`;
const MAX_RETRIES = 20;
const RETRY_INTERVAL = 2000;

async function waitForServer(onAttempt) {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return { ok: true };
    } catch {}
    onAttempt(i);
    await new Promise(r => setTimeout(r, RETRY_INTERVAL));
  }
  return { ok: false };
}

function parseError(error) {
  const msg = (error?.message || String(error)).toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed'))
    return { icon: 'offline', message: 'No connection to the server. Check your internet or try again shortly.' };
  if (msg.includes('timeout') || msg.includes('aborted'))
    return { icon: 'timeout', message: 'Request timed out. The server may be busy — please try again.' };
  if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('taken'))
    return { icon: 'alert', message: 'That username is already taken. Please choose another.' };
  if (msg.includes('500') || msg.includes('internal server'))
    return { icon: 'server', message: 'Server error. Please try again in a moment.' };
  if (msg.includes('401') || msg.includes('403'))
    return { icon: 'alert', message: 'Access denied. Please check your credentials.' };
  if (error?.message && error.message.length < 120)
    return { icon: 'alert', message: error.message };
  return { icon: 'alert', message: 'Registration failed. Please try again.' };
}

const iconMap = { offline: WifiOff, timeout: Clock, server: Server, alert: AlertCircle };
const colorMap = { offline: 'text-red-400', timeout: 'text-orange-400', server: 'text-red-400', alert: 'text-red-400' };

const ErrorBanner = ({ icon, message }) => {
  const Icon = iconMap[icon] ?? AlertCircle;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-fade-in">
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${colorMap[icon]}`} />
      <span>{message}</span>
    </div>
  );
};

const ServerWakingOverlay = ({ attempt }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-slate-800 border border-slate-700 p-8 shadow-2xl max-w-xs w-full text-center mx-4">
      <div className="relative flex items-center justify-center w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
        <div className="absolute inset-0 rounded-full border-4 border-t-primary-500 animate-spin" />
        <Server className="w-7 h-7 text-primary-400" />
      </div>
      <div>
        <p className="font-semibold text-white text-lg">Waking up the server…</p>
        <p className="text-slate-400 text-sm mt-1 leading-relaxed">
          The backend is starting. This usually takes 10–30 seconds on a free tier.
        </p>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-primary-500 transition-all duration-500 rounded-full"
          style={{ width: `${Math.min((attempt / MAX_RETRIES) * 100, 95)}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">Attempt {attempt} of {MAX_RETRIES}</p>
    </div>
  </div>
);

const Register = () => {
  const [formData, setFormData] = useState({ username: '', password: '', confirmPassword: '', avatar: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [wakingServer, setWakingServer] = useState(false);
  const [wakeAttempt, setWakeAttempt] = useState(0);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (apiError) setApiError(null);
  };

  const generateAvatar = () =>
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.username || Math.random().toString(36).substr(2, 9)}`;

  const validate = () => {
    const e = {};
    if (!formData.username.trim()) e.username = 'Username is required';
    else if (formData.username.length < 3) e.username = 'Username must be at least 3 characters';
    else if (formData.username.length > 30) e.username = 'Username cannot exceed 30 characters';
    if (!formData.password) e.password = 'Password is required';
    else if (formData.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (!formData.confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const getPasswordStrength = () => {
    const p = formData.password;
    if (!p) return { strength: 0, label: '', color: '' };
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^a-zA-Z0-9]/.test(p)) s++;
    const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];
    const idx = Math.min(s - 1, 4);
    return { strength: Math.min(s, 5), label: labels[idx] || '', color: colors[idx] || '' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError(null);

    let serverAlive = false;
    try {
      const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(4000) });
      serverAlive = res.ok;
    } catch {}

    if (!serverAlive) {
      setWakingServer(true);
      setWakeAttempt(1);
      const result = await waitForServer((attempt) => setWakeAttempt(attempt));
      setWakingServer(false);
      if (!result.ok) {
        setLoading(false);
        setApiError({ icon: 'server', message: 'Server did not respond after 40 seconds. Please wait a moment and try again.' });
        return;
      }
    }

    try {
      const registerData = { ...formData, avatar: formData.avatar || generateAvatar() };
      const result = await register(registerData);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setApiError(parseError(new Error(result.error || result.message || 'Registration failed')));
      }
    } catch (err) {
      setApiError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength();
  const avatarUrl = formData.avatar || (formData.username ? generateAvatar() : '');

  const inputClass = (hasError) =>
    `w-full bg-slate-700 border text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm sm:text-base outline-none transition-all focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
      hasError ? 'border-red-500' : 'border-slate-600 hover:border-slate-500'
    }`;

  return (
    <>
      {wakingServer && <ServerWakingOverlay attempt={wakeAttempt} />}

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="text-center mb-6 sm:mb-8 animate-slide-up">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl shadow-glow mb-3 sm:mb-4 overflow-hidden">
              <img src={AppLogo} alt="V-Meet Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">Join V-Meet</h1>
            <p className="text-sm sm:text-base text-slate-400">Create your account to get started</p>
          </div>

          {/* Form Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 sm:p-8 shadow-xl animate-fade-in">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">

              {apiError && <ErrorBanner icon={apiError.icon} message={apiError.message} />}

              {/* Avatar Preview */}
              {avatarUrl && (
                <div className="flex justify-center">
                  <div className="relative">
                    <img src={avatarUrl} alt="Avatar Preview" className="w-20 h-20 sm:w-24 sm:h-24 rounded-full ring-4 ring-slate-600" />
                    <div className="absolute -bottom-2 -right-2 w-7 h-7 sm:w-8 sm:h-8 bg-primary-600 rounded-full flex items-center justify-center">
                      <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </div>
                  </div>
                </div>
              )}

              {/* Username */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
                <input
                  type="text" id="username" name="username" value={formData.username}
                  onChange={handleChange} autoComplete="username" placeholder="Choose a username"
                  className={inputClass(errors.username)}
                />
                {errors.username && <p className="mt-1 text-xs sm:text-sm text-red-400">{errors.username}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} id="password" name="password"
                    value={formData.password} onChange={handleChange} autoComplete="new-password"
                    placeholder="Create a password"
                    className={inputClass(errors.password) + ' pr-12'}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1">
                    {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs sm:text-sm text-red-400">{errors.password}</p>}
                {formData.password && (
                  <div className="mt-2 flex items-center space-x-2">
                    <div className="flex-1 h-1.5 sm:h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full ${passwordStrength.color} transition-all duration-300`}
                        style={{ width: `${(passwordStrength.strength / 5) * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium text-slate-400 flex-shrink-0">{passwordStrength.label}</span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'} id="confirmPassword" name="confirmPassword"
                    value={formData.confirmPassword} onChange={handleChange} autoComplete="new-password"
                    placeholder="Confirm your password"
                    className={inputClass(errors.confirmPassword) + ' pr-12'}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs sm:text-sm text-red-400">{errors.confirmPassword}</p>}
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full btn btn-primary flex items-center justify-center space-x-2 py-3 text-sm sm:text-base disabled:opacity-60">
                {loading
                  ? <><div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Creating account…</span></>
                  : <><UserPlus className="w-4 h-4 sm:w-5 sm:h-5" /><span>Create Account</span></>}
              </button>
            </form>

            <div className="mt-5 sm:mt-6 text-center">
              <p className="text-sm sm:text-base text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="text-primary-400 hover:text-primary-300 font-semibold transition-colors">Sign in</Link>
              </p>
            </div>
          </div>

          <p className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-slate-600">© 2024 V-Meet. All rights reserved.</p>
        </div>
      </div>
    </>
  );
};

export default Register;