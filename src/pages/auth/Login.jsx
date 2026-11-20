import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { broadcastLogin } from '../../hooks/useTabSessionGuard';
import { useModuleStore } from '../../store/useModuleStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import toast from 'react-hot-toast';
import './Login.scss';
import { API_BASE_URL } from '../../config';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const { clearModule } = useModuleStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      // Every login — Super Admin too — is checked by the server (2026-11-20).
      let res, json;
      try {
        res = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email.trim().toLowerCase(), password: data.password }),
        });
        // Read as text first — if server sends HTML (404/500) this gives a clear message
        const text = await res.text();
        try {
          json = JSON.parse(text);
        } catch {
          toast.error('Backend server is not responding correctly. Please make sure it is running.');
          return;
        }
      } catch {
        toast.error('Could not connect to server. Please check that the backend is running.');
        return;
      }

      if (!json.ok) {
        toast.error(json.message || 'Invalid email or password');
        return;
      }

      const { user, token, permissions } = json.data;
      login({ ...user, permissions }, token);
      broadcastLogin(user.id);
      clearModule();
      toast.success(`Welcome, ${user.name}!`);
      navigate('/dashboard');
    } catch {
      toast.error('Could not connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <Building2 className="login-icon" />
        <h1>Darul Shifa Imam Khomeini</h1>
        <p>Hospital Management System</p>
        {/* <span className="login-version">v1.0</span> */}
      </div>
      <div className="login-right">
        <div className="login-card">
          <h2>Welcome Back</h2>
          <p className="login-subtitle">Sign in to your account</p>
          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              error={errors.email?.message}
              {...register('email', { required: 'Email is required' })}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              error={errors.password?.message}
              {...register('password', { required: 'Password is required' })}
            />
            <div className="login-options">
              <label className="flex items-center gap-2">
                <input type="checkbox" {...register('remember')} />
                <span>Remember me</span>
              </label>
              <Link to="#" className="login-forgot">Forgot Password?</Link>
            </div>
            <Button
              type="submit"
              label="Login"
              fullWidth
              loading={loading}
              className="login-btn"
            />
          </form>
          {/* <div className="login-hint">
            <p>Admin: admin@hospital.com / admin123</p>
          </div> */}
        </div>
      </div>
    </div>
  );
}
