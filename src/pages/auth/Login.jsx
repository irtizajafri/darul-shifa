import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useModuleStore } from '../../store/useModuleStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import toast from 'react-hot-toast';
import './Login.scss';

const dummyUser = {
  name: 'Dr.Nadeem Abbas',
  role: 'Administrator',
  email: 'admin@hospital.com',
  avatar: null,
};

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
    await new Promise((r) => setTimeout(r, 1500));
    login({ ...dummyUser, email: data.email });
    clearModule();
    toast.success('Login successful!');
    navigate('/dashboard');
    setLoading(false);
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
          <div className="login-hint">
            <p>Demo: admin@hospital.com / admin123</p>
          </div>
        </div>
        <p className="login-signup">
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
